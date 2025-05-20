FROM archlinux
RUN echo "[multilib]" >> /etc/pacman.conf && echo "Include = /etc/pacman.d/mirrorlist" >> /etc/pacman.conf && pacman -Sy

RUN pacman -S --noconfirm nodejs npm wine wine-mono openjpeg2 git openssh
RUN useradd --create-home --shell /bin/bash builder
USER builder
WORKDIR /home/builder