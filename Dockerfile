FROM oven/bun:1.4.3 AS build
WORKDIR /workspace
COPY . .
RUN bun install --frozen-lockfile --filter '!@calendarpit/docs'
RUN bun run --cwd apps/calendarpit build && bun run --cwd apps/calendarpit build:binary

FROM oven/bun:1.4.3-slim AS runtime
WORKDIR /app
COPY --from=build /workspace/apps/calendarpit/dist/bin/calendarpit /usr/local/bin/calendarpit
RUN mkdir -p /data && chown bun:bun /data
ENV CALENDARPIT_DATABASE=/data/calendarpit.sqlite
ENV CALENDARPIT_HOST=0.0.0.0
ENV CALENDARPIT_PORT=4173
LABEL org.opencontainers.image.source="https://github.com/iktakahiro/calendarpit"
LABEL org.opencontainers.image.licenses="MIT"
VOLUME ["/data"]
USER bun
EXPOSE 4173
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 CMD bun -e 'const response = await fetch("http://127.0.0.1:" + (process.env.CALENDARPIT_PORT || "4173") + "/__calendarpit/health"); process.exit(response.ok ? 0 : 1)'
ENTRYPOINT ["calendarpit"]
CMD ["serve"]
