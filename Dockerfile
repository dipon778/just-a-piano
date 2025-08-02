FROM nginx:alpine
COPY . /usr/share/nginx/html
COPY sounds/ /usr/share/nginx/html/sounds/
EXPOSE 80
