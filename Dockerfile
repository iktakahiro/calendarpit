FROM oven/bun:1.4.3 AS build
WORKDIR /workspace
COPY . .
RUN bun install --frozen-lockfile --filter '!@calendarpit/docs'
RUN bun run build:binary

FROM oven/bun:1.4.3-slim AS runtime
WORKDIR /app
COPY --from=build /workspace/apps/calendarpit/dist/bin/calendarpit /usr/local/bin/calendarpit
RUN mkdir -p /data && chown bun:bun /data
ENV CALENDARPIT_DATABASE=/data/calendarpit.sqlite
VOLUME ["/data"]
USER bun
EXPOSE 4173
ENTRYPOINT ["calendarpit"]
CMD ["serve", "--host", "0.0.0.0", "--port", "4173"]
