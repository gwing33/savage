# ─────────────────────────────────────────────────────────────────────────────
# Savage – Raspberry Pi Server Container
#
# Mimics Raspberry Pi OS (64-bit) environment:
#   • Architecture : linux/arm64 (aarch64)
#   • Base OS      : Debian GNU/Linux 12 "Bookworm"  (same as Raspberry Pi OS)
# ─────────────────────────────────────────────────────────────────────────────
FROM --platform=linux/arm64 debian:bookworm-slim

# ── Labels ────────────────────────────────────────────────────────────────────
LABEL org.opencontainers.image.title="savage"
LABEL org.opencontainers.image.description="Raspberry Pi server environment"
LABEL org.opencontainers.image.base.name="debian:bookworm-slim"
LABEL architecture="arm64"

# ── Environment ───────────────────────────────────────────────────────────────
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TZ=UTC

# ── System packages ───────────────────────────────────────────────────────────
# Mirrors a typical Raspberry Pi OS install:
#   • Core utilities (curl, wget, git, sudo, tzdata, ca-certificates)
#   • Python 3 + pip  (the dominant scripting language on Pi)
#   • I²C / SPI / GPIO userspace tools
#   • Networking helpers (iproute2, net-tools, iputils-ping)
#   • Serial / hardware helpers (usbutils, v4l-utils)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # ── core ──────────────────────────────────────
    ca-certificates \
    curl \
    wget \
    git \
    sudo \
    tzdata \
    locales \
    procps \
    htop \
    vim-tiny \
    less \
    unzip \
    # ── python ────────────────────────────────────
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    # ── hardware / GPIO interfaces ─────────────────
    i2c-tools \
    python3-smbus \
    # ── networking ────────────────────────────────
    iproute2 \
    net-tools \
    iputils-ping \
    dnsutils \
    openssh-client \
    # ── serial / usb / camera ─────────────────────
    usbutils \
    minicom \
    && rm -rf /var/lib/apt/lists/*

# ── Locale ────────────────────────────────────────────────────────────────────
RUN sed -i 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen \
    && locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8

# ── Timezone ──────────────────────────────────────────────────────────────────
# Override at runtime with: -e TZ=America/New_York
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

# ── Non-root user (mirrors the default "pi" user on Raspberry Pi OS) ──────────
RUN useradd -m -s /bin/bash -G sudo pi \
    && echo "pi ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/pi \
    && chmod 0440 /etc/sudoers.d/pi

USER pi
WORKDIR /home/pi

# ── Default command ───────────────────────────────────────────────────────────
CMD ["/bin/bash"]
