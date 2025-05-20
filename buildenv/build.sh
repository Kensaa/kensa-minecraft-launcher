#! /bin/sh
docker buildx build -t docker.kensa.fr/electron-build-image . 
docker push docker.kensa.fr/electron-build-image
