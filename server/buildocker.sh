#! /bin/sh
docker buildx build -t docker.kensa.fr/kensa-minecraft-launcher-server . 
docker push docker.kensa.fr/kensa-minecraft-launcher-server
