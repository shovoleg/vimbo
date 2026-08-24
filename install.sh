#!/bin/bash
set -e
cd "$(dirname "$0")"

if docker compose version >/dev/null 2>&1; then DC="docker compose"
elif docker-compose version >/dev/null 2>&1; then DC="docker-compose"
else DC="/var/packages/ContainerManager/target/usr/bin/docker-compose"; fi
echo "Используется: $DC"

if [ -f compose.yaml ]; then
    mv compose.yaml "compose.yaml.disabled-$(date +%Y%m%d-%H%M%S)"
    echo "Лишний compose.yaml переименован."
fi

echo "════════════════════════════════════════════════════════"
echo " 1/6  Файл .env"
echo "════════════════════════════════════════════════════════"
if [ ! -f .env ]; then
    cat > .env <<ENVEOF
MAX_PARALLEL=2
ENVEOF
    chmod 600 .env
    echo "  .env создан"
else
    echo "  .env уже существует — не трогаем"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo " 2/6  Проверка комплектности"
echo "════════════════════════════════════════════════════════"
MISSING=0
for f in docker-compose.yml docker/php/Dockerfile docker/node/Dockerfile \
         docker/nginx/default.conf api/public/index.php api/composer.json \
         video/src/server.js video/package.json web/dist/index.html; do
    if [ -e "$f" ]; then
        echo "  есть   $f"
    else
        echo "  НЕТ    $f"
        MISSING=1
    fi
done

if [ ! -f web/dist/index.html ]; then
    echo ""
    echo "  Каталог web/dist отсутствует. Соберите фронтенд на компьютере:"
    echo "    cd web && npm install && npm run build"
    exit 1
fi

LOCALES=$(ls data/locales/*.json 2>/dev/null | wc -l)
echo "  словарей локалей: $LOCALES"
[ "$LOCALES" -lt 1 ] && { echo "  Нет ни одного словаря — прерываю."; exit 1; }
[ "$MISSING" = "1" ] && { echo "  Комплект неполный — прерываю."; exit 1; }

echo ""
echo "════════════════════════════════════════════════════════"
echo " 3/6  Каталоги для кэша"
echo "════════════════════════════════════════════════════════"
mkdir -p storage/cache/posters storage/clips
chmod -R 777 storage
echo "  storage/ готов"

echo ""
echo "════════════════════════════════════════════════════════"
echo " 4/6  Сборка образов"
echo "════════════════════════════════════════════════════════"
$DC build 2>&1 | tail -6

echo ""
echo "════════════════════════════════════════════════════════"
echo " 5/6  Запуск"
echo "════════════════════════════════════════════════════════"
$DC up -d 2>&1 | tail -6

echo ""
echo "  Жду готовности сервисов (ставятся зависимости PHP и Node, до 2 минут)…"
for i in $(seq 1 48); do
    sleep 5
    UP=$($DC ps --format '{{.Name}} {{.Status}}' 2>/dev/null | grep -c "healthy" || true)
    printf "\r  готовы: %s/2" "$UP"
    [ "$UP" -ge 2 ] && break
done
echo ""
$DC ps 2>/dev/null | tail -5

echo ""
echo "════════════════════════════════════════════════════════"
echo " 6/6  Проверка"
echo "════════════════════════════════════════════════════════"
OK=1
for p in / /api/locales; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "http://127.0.0.1:8087${p}")
    printf "  %-16s -> %s" "$p" "$CODE"
    [ "$CODE" = "200" ] && echo "  ок" || { echo "  НЕ ОЖИДАЛОСЬ"; OK=0; }
done

echo ""
if [ "$OK" = "1" ]; then
    echo "  ГОТОВО. Откройте http://192.168.1.155:8087"
    echo ""
    echo "  Первый трейлер собирается несколько секунд, дальше берётся из кэша."
else
    echo "  Что-то не так. Смотрите:"
    echo "    $DC logs --tail=40 video"
    echo "    $DC logs --tail=40 api"
fi
echo "════════════════════════════════════════════════════════"
