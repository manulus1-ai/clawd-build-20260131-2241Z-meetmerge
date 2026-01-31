using System.Security.Cryptography;
using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);

var corsOrigins = (builder.Configuration["CORS_ORIGINS"] ?? "*")
  .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

builder.Services.AddCors(opt =>
{
  opt.AddDefaultPolicy(policy =>
  {
    if (corsOrigins.Length == 0 || (corsOrigins.Length == 1 && corsOrigins[0] == "*"))
      policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
    else
      policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod();
  });
});

var app = builder.Build();
app.UseCors();

var dbPath = builder.Configuration["DB_PATH"] ?? "/data/meetmerge.db";
Directory.CreateDirectory(Path.GetDirectoryName(dbPath) ?? "/data");

using (var conn = Open(dbPath))
{
  conn.Open();
  InitDb(conn);
}

// super tiny rate limit: ~60 writes/min per IP
var limiter = new SimpleIpLimiter(60, TimeSpan.FromMinutes(1));

app.MapGet("/api/health", () => Results.Ok(new { ok = true }));

app.MapPost("/api/polls", async (CreatePollRequest req, HttpContext ctx) =>
{
  if (!limiter.Allow(ctx)) return Results.StatusCode(429);

  if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "title required" });
  if (req.Slots is null || req.Slots.Count < 3 || req.Slots.Count > 7)
    return Results.BadRequest(new { error = "slots must be 3..7" });

  var pollId = Id("p");
  var hostKey = Secret();
  var createdAt = DateTimeOffset.UtcNow;

  using var conn = Open(dbPath);
  await conn.OpenAsync();

  using var tx = conn.BeginTransaction();

  Exec(conn, @"INSERT INTO polls(id,title,description,created_at_iso,host_key,locked_slot_id)
              VALUES($id,$title,$desc,$created,$hostKey,NULL)",
    ("$id", pollId),
    ("$title", req.Title.Trim()),
    ("$desc", (object?) (req.Description?.Trim()) ?? DBNull.Value),
    ("$created", createdAt.ToString("O")),
    ("$hostKey", hostKey)
  );

  foreach (var s in req.Slots)
  {
    if (string.IsNullOrWhiteSpace(s.StartIso)) continue;
    var slotId = Id("s");
    Exec(conn, "INSERT INTO slots(id,poll_id,start_iso) VALUES($id,$pollId,$start)",
      ("$id", slotId),
      ("$pollId", pollId),
      ("$start", s.StartIso.Trim())
    );
  }

  tx.Commit();

  return Results.Ok(new { pollId, hostKey });
});

app.MapGet("/api/polls/{pollId}", async (string pollId, string? hostKey) =>
{
  using var conn = Open(dbPath);
  await conn.OpenAsync();

  var poll = QuerySingle(conn, @"SELECT id,title,description,created_at_iso,locked_slot_id,host_key
                               FROM polls WHERE id=$id", ("$id", pollId));
  if (poll is null) return Results.NotFound();

  var isHost = !string.IsNullOrWhiteSpace(hostKey) && hostKey == (string)poll["host_key"];

  var slots = Query(conn, "SELECT id,start_iso FROM slots WHERE poll_id=$pid ORDER BY start_iso", ("$pid", pollId))
    .Select(r => new { id = (string)r["id"], startIso = (string)r["start_iso"] })
    .ToList();

  var tallies = slots.Select(s =>
  {
    var yes = ScalarInt(conn, "SELECT COUNT(1) FROM votes WHERE poll_id=$pid AND slot_id=$sid AND choice='yes'",
      ("$pid", pollId), ("$sid", s.id));
    var maybe = ScalarInt(conn, "SELECT COUNT(1) FROM votes WHERE poll_id=$pid AND slot_id=$sid AND choice='maybe'",
      ("$pid", pollId), ("$sid", s.id));
    var no = ScalarInt(conn, "SELECT COUNT(1) FROM votes WHERE poll_id=$pid AND slot_id=$sid AND choice='no'",
      ("$pid", pollId), ("$sid", s.id));
    return new { slotId = s.id, yes, maybe, no };
  }).ToList();

  var dto = new
  {
    poll = new
    {
      id = (string)poll["id"],
      title = (string)poll["title"],
      description = poll["description"] is DBNull ? null : (string)poll["description"],
      createdAtIso = (string)poll["created_at_iso"],
      lockedSlotId = poll["locked_slot_id"] is DBNull ? null : (string)poll["locked_slot_id"],
      slots,
    },
    tallies,
    // only visible to host if needed later; keep payload clean
    host = isHost ? new { ok = true } : null,
  };

  return Results.Ok(dto);
});

app.MapPost("/api/polls/{pollId}/votes", async (string pollId, VoteRequest req, HttpContext ctx) =>
{
  if (!limiter.Allow(ctx)) return Results.StatusCode(429);

  if (string.IsNullOrWhiteSpace(req.SlotId)) return Results.BadRequest(new { error = "slotId required" });
  if (req.Choice is not ("yes" or "maybe" or "no")) return Results.BadRequest(new { error = "invalid choice" });

  using var conn = Open(dbPath);
  await conn.OpenAsync();

  var exists = ScalarInt(conn, "SELECT COUNT(1) FROM polls WHERE id=$id", ("$id", pollId));
  if (exists == 0) return Results.NotFound();

  // reject votes after lock
  var locked = QuerySingle(conn, "SELECT locked_slot_id FROM polls WHERE id=$id", ("$id", pollId));
  if (locked is not null && locked["locked_slot_id"] is not DBNull) return Results.StatusCode(409);

  // Each device/browser is anonymous; we use a provided voteKey cookie to avoid infinite duplicates.
  var voteKey = ctx.Request.Cookies["mm_vote_key"];
  if (string.IsNullOrWhiteSpace(voteKey))
  {
    voteKey = Secret();
    ctx.Response.Cookies.Append("mm_vote_key", voteKey, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, Secure = false, MaxAge = TimeSpan.FromDays(30) });
  }

  // upsert (poll_id, slot_id, voter_key)
  Exec(conn, @"INSERT INTO votes(poll_id,slot_id,voter_key,choice,voted_at_iso)
              VALUES($pid,$sid,$vk,$choice,$at)
              ON CONFLICT(poll_id,slot_id,voter_key) DO UPDATE SET choice=$choice, voted_at_iso=$at",
    ("$pid", pollId),
    ("$sid", req.SlotId.Trim()),
    ("$vk", voteKey),
    ("$choice", req.Choice),
    ("$at", DateTimeOffset.UtcNow.ToString("O"))
  );

  return Results.Ok(new { ok = true });
});

app.MapPost("/api/polls/{pollId}/lock", async (string pollId, LockRequest req, HttpContext ctx) =>
{
  if (!limiter.Allow(ctx)) return Results.StatusCode(429);

  if (string.IsNullOrWhiteSpace(req.SlotId) || string.IsNullOrWhiteSpace(req.HostKey))
    return Results.BadRequest(new { error = "slotId + hostKey required" });

  using var conn = Open(dbPath);
  await conn.OpenAsync();

  var poll = QuerySingle(conn, "SELECT host_key FROM polls WHERE id=$id", ("$id", pollId));
  if (poll is null) return Results.NotFound();
  if ((string)poll["host_key"] != req.HostKey) return Results.StatusCode(403);

  Exec(conn, "UPDATE polls SET locked_slot_id=$sid WHERE id=$id", ("$sid", req.SlotId.Trim()), ("$id", pollId));
  return Results.Ok(new { ok = true });
});

app.Run();

static SqliteConnection Open(string dbPath)
  => new($"Data Source={dbPath};Cache=Shared");

static void InitDb(SqliteConnection conn)
{
  Exec(conn, @"
CREATE TABLE IF NOT EXISTS polls(
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NULL,
  created_at_iso TEXT NOT NULL,
  host_key TEXT NOT NULL,
  locked_slot_id TEXT NULL
);
CREATE TABLE IF NOT EXISTS slots(
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  start_iso TEXT NOT NULL,
  FOREIGN KEY(poll_id) REFERENCES polls(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS votes(
  poll_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  voter_key TEXT NOT NULL,
  choice TEXT NOT NULL,
  voted_at_iso TEXT NOT NULL,
  PRIMARY KEY(poll_id, slot_id, voter_key),
  FOREIGN KEY(poll_id) REFERENCES polls(id) ON DELETE CASCADE
);
");
}

static void Exec(SqliteConnection conn, string sql, params (string, object)[] p)
{
  using var cmd = conn.CreateCommand();
  cmd.CommandText = sql;
  foreach (var (k, v) in p) cmd.Parameters.AddWithValue(k, v);
  cmd.ExecuteNonQuery();
}

static Dictionary<string, object>? QuerySingle(SqliteConnection conn, string sql, params (string, object)[] p)
{
  using var cmd = conn.CreateCommand();
  cmd.CommandText = sql;
  foreach (var (k, v) in p) cmd.Parameters.AddWithValue(k, v);
  using var r = cmd.ExecuteReader();
  if (!r.Read()) return null;
  var d = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
  for (var i = 0; i < r.FieldCount; i++) d[r.GetName(i)] = r.GetValue(i);
  return d;
}

static List<Dictionary<string, object>> Query(SqliteConnection conn, string sql, params (string, object)[] p)
{
  using var cmd = conn.CreateCommand();
  cmd.CommandText = sql;
  foreach (var (k, v) in p) cmd.Parameters.AddWithValue(k, v);
  using var r = cmd.ExecuteReader();
  var list = new List<Dictionary<string, object>>();
  while (r.Read())
  {
    var d = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
    for (var i = 0; i < r.FieldCount; i++) d[r.GetName(i)] = r.GetValue(i);
    list.Add(d);
  }
  return list;
}

static int ScalarInt(SqliteConnection conn, string sql, params (string, object)[] p)
{
  using var cmd = conn.CreateCommand();
  cmd.CommandText = sql;
  foreach (var (k, v) in p) cmd.Parameters.AddWithValue(k, v);
  var o = cmd.ExecuteScalar();
  return o is null || o is DBNull ? 0 : Convert.ToInt32(o);
}

static string Id(string prefix)
  => $"{prefix}_{Convert.ToHexString(RandomNumberGenerator.GetBytes(6)).ToLowerInvariant()}";

static string Secret()
  => Convert.ToHexString(RandomNumberGenerator.GetBytes(18)).ToLowerInvariant();

record CreatePollRequest(string Title, string? Description, List<CreateSlot> Slots);
record CreateSlot(string StartIso);
record VoteRequest(string SlotId, string Choice);
record LockRequest(string SlotId, string HostKey);

sealed class SimpleIpLimiter
{
  private readonly int _limit;
  private readonly TimeSpan _window;
  private readonly object _lock = new();
  private readonly Dictionary<string, List<DateTimeOffset>> _hits = new();

  public SimpleIpLimiter(int limit, TimeSpan window)
  {
    _limit = limit;
    _window = window;
  }

  public bool Allow(HttpContext ctx)
  {
    var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    var now = DateTimeOffset.UtcNow;
    lock (_lock)
    {
      if (!_hits.TryGetValue(ip, out var list))
      {
        list = new List<DateTimeOffset>();
        _hits[ip] = list;
      }

      list.RemoveAll(t => now - t > _window);
      if (list.Count >= _limit) return false;
      list.Add(now);
      return true;
    }
  }
}
