FROM php:8.3-cli-alpine

RUN apk add --no-cache bash curl git icu-dev libzip-dev oniguruma-dev zip \
    && docker-php-ext-install intl mbstring pdo_mysql zip

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

