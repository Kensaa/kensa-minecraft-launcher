#! /bin/sh
sudo docker buildx build -t docker.kensa.fr/electron-build-image . 
sudo docker push docker.kensa.fr/electron-build-image
