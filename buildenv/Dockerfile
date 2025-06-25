FROM archlinux
RUN printf "[multilib]\nInclude = /etc/pacman.d/mirrorlist\n" >> /etc/pacman.conf

RUN pacman -Syu --noconfirm nodejs npm wine wine-mono openjpeg2 git openssh jq github-cli