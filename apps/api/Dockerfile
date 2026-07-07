# syntax=docker/dockerfile:1

# =============================================================================
# Laravel API — production PHP-FPM image
#
# This image is for PRE-DEPLOY VALIDATION, not day-to-day dev (that stays on
# Herd). The full app is baked into the image; there is no source bind-mount.
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: base — PHP 8.4-fpm + the extensions Laravel needs at runtime
# ---------------------------------------------------------------------------
FROM php:8.4-fpm AS base

# System libraries required to build (and then run) the PHP extensions below.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        unzip \
        libzip-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        libonig-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql \
        mbstring \
        exif \
        pcntl \
        bcmath \
        gd \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

# ---------------------------------------------------------------------------
# Stage 2: vendor — install production Composer dependencies + app source
# ---------------------------------------------------------------------------
FROM base AS vendor

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Install dependencies first (better layer caching), skipping scripts because
# the application source is not present yet.
COPY composer.json composer.lock ./
RUN composer install \
        --no-dev \
        --optimize-autoloader \
        --no-interaction \
        --no-scripts \
        --prefer-dist

# Bring in the source and regenerate an optimized autoloader. Scripts are
# skipped (no .env at build time); Laravel builds its package manifest at
# runtime into bootstrap/cache, which is made writable in the production stage.
COPY . .
RUN composer dump-autoload --optimize --no-dev --no-scripts

# ---------------------------------------------------------------------------
# Stage 3: production — lean runtime image
# ---------------------------------------------------------------------------
FROM base AS production

# Copy the fully built application (source + vendor) from the vendor stage.
COPY --from=vendor /var/www/html /var/www/html

# storage/ and bootstrap/cache/ must be writable by the php-fpm user.
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

USER www-data

EXPOSE 9000

CMD ["php-fpm"]
