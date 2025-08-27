FROM archlinux
RUN printf "[multilib]\nInclude = /etc/pacman.d/mirrorlist\n" >> /etc/pacman.conf
RUN pacman -Syu --noconfirm nodejs npm wine wine-mono openjpeg2 git openssh jq github-cli wget

RUN wget -O /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.5/dumb-init_1.2.5_x86_64
RUN chmod +x /usr/local/bin/dumb-init

ENTRYPOINT ["dumb-init", "--"]