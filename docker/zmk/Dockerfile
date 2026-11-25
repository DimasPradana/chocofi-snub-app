# ZMK builder image — fully offline after build.
# Toolchain: Zephyr SDK 0.16.3 (Zephyr 3.5), matching ZMK v0.3.x.
FROM oven/bun:1-debian AS bun

FROM zmkfirmware/zmk-build-arm:3.5

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

# West workspace baked into the image: ZMK + Zephyr + HALs + extra modules
# (zmk-nice-oled) are downloaded ONCE here, so builds need no internet.
WORKDIR /workspace
COPY zmk-config/config/west.yml /workspace/config/west.yml
RUN west init -l config \
 && west update --narrow --fetch-opt=--depth=1 \
 && west zephyr-export \
 && cp config/west.yml /workspace/.baked-west.yml

# Run as uid 1000 (matches the host user owning ./zmk-config and ./firmware)
ENV HOME=/home/ubuntu
RUN git config --system --add safe.directory "*" \
 && HOME=/home/ubuntu west zephyr-export \
 && mkdir -p /build-cache /firmware \
 && chown -R 1000:1000 /home/ubuntu /build-cache /firmware

WORKDIR /app
COPY docker/zmk/builder.ts /app/builder.ts
USER 1000:1000

ENV ZMK_CONFIG_DIR=/zmk-config \
    FIRMWARE_DIR=/firmware \
    BUILD_CACHE_DIR=/build-cache \
    WEST_WORKSPACE=/workspace \
    PORT=8080

EXPOSE 8080
CMD ["bun", "/app/builder.ts"]
