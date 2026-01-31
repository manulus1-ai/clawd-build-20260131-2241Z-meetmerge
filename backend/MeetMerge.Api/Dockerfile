# Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY MeetMerge.Api.csproj ./
RUN dotnet restore
COPY . ./
RUN dotnet publish -c Release -o /out

# Run
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENV DB_PATH=/data/meetmerge.db
COPY --from=build /out ./
VOLUME ["/data"]
EXPOSE 8080
ENTRYPOINT ["dotnet", "MeetMerge.Api.dll"]
