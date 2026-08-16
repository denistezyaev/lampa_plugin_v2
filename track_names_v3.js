(function () {
    'use strict';

    var DEBUG = true;

    // ---------- Панель отладки в правом верхнем углу ----------
    var debugBox = null;
    function log(msg) {
        if (!DEBUG) return;
        try {
            if (!debugBox) {
                debugBox = document.createElement('div');
                debugBox.style.cssText =
                    'position:fixed;top:0;right:0;width:38%;max-height:45%;overflow:auto;' +
                    'background:rgba(0,0,0,0.85);color:#0f0;font-size:12px;line-height:1.25;' +
                    'padding:6px;z-index:999999;white-space:pre-wrap;font-family:monospace;' +
                    'pointer-events:none;';
                (document.body || document.documentElement).appendChild(debugBox);
            }
            var line = document.createElement('div');
            line.textContent = new Date().toLocaleTimeString() + '  ' + msg;
            debugBox.appendChild(line);
            debugBox.scrollTop = debugBox.scrollHeight;
        } catch (e) {}
    }

    log('track_names_ru_v3 (диагностика): плагин загружен');

    // ---------- Подписка на внутреннее событие Lampa.PlayerVideo 'tracks' ----------
    var hooked = false;
    function tryHook() {
        try {
            if (window.Lampa && Lampa.PlayerVideo && Lampa.PlayerVideo.listener && typeof Lampa.PlayerVideo.listener.follow === 'function') {
                Lampa.PlayerVideo.listener.follow('tracks', function (e) {
                    log('Событие "tracks" сработало!');
                    try {
                        var tracks = e && e.tracks;
                        if (!tracks) { log('e.tracks пусто/отсутствует'); return; }
                        log('Кол-во дорожек: ' + tracks.length);
                        var probeNames = ['language', 'lang', 'label', 'title', 'name', 'id', 'index', 'kind', 'active', 'enabled', 'codec', 'channels'];
                        tracks.forEach(function (t, i) {
                            var found = [];
                            probeNames.forEach(function (k) {
                                var v;
                                try { v = t[k]; } catch (e) { v = '(ошибка чтения)'; }
                                if (v !== undefined) found.push(k + '=' + JSON.stringify(v));
                            });
                            log('  [' + i + '] ' + (found.length ? found.join(', ') : '(ни одно из известных полей не отозвалось)'));
                            try { log('  [' + i + '] toString: ' + String(t)); } catch (e) {}
                        });
                    } catch (err) {
                        log('Ошибка разбора e.tracks: ' + err.message);
                    }
                });
                log('Подписка на Lampa.PlayerVideo "tracks" установлена успешно');
                hooked = true;
                return true;
            }
        } catch (err) {
            log('Ошибка при попытке подписки: ' + err.message);
        }
        return false;
    }

    if (!tryHook()) {
        log('Lampa.PlayerVideo ещё недоступен, жду появления...');
        var attempts = 0;
        var iv = setInterval(function () {
            attempts++;
            if (tryHook()) {
                clearInterval(iv);
            } else if (attempts > 40) { // ~20 секунд
                clearInterval(iv);
                log('Не дождался Lampa.PlayerVideo за 20 сек — объект недоступен в этой версии Lampa');
            }
        }, 500);
    }

    // Также попробуем поймать общее событие video (на случай другого названия объекта)
    try {
        if (window.Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
            Lampa.Listener.follow('player', function (e) {
                log('Lampa.Listener "player" событие: type=' + (e && e.type));
            });
        }
    } catch (e) {}
})();
