(function () {
    'use strict';

    var DEBUG = false; // поставьте true, если понадобится снова включить панель отладки в углу экрана

    // ---------- Панель отладки (по умолчанию выключена) ----------
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

    log('track_names_final: плагин загружен');

    // ---------- Словарь языков (запасной вариант) ----------
    var LANG_MAP = {
        rus: 'Русский', ru: 'Русский',
        eng: 'Английский', en: 'Английский',
        ukr: 'Украинский', uk: 'Украинский',
        bel: 'Белорусский',
        deu: 'Немецкий', ger: 'Немецкий', de: 'Немецкий',
        fra: 'Французский', fre: 'Французский', fr: 'Французский',
        spa: 'Испанский', es: 'Испанский',
        ita: 'Итальянский', it: 'Итальянский',
        jpn: 'Японский', ja: 'Японский',
        kor: 'Корейский', ko: 'Корейский',
        chi: 'Китайский', zho: 'Китайский', zh: 'Китайский',
        pol: 'Польский',
        tur: 'Турецкий',
        por: 'Португальский',
        und: 'Без метки языка',
        mis: 'Без метки языка'
    };

    // Реальные данные о дорожках из Lampa.PlayerVideo (index -> {label, language})
    var trackInfo = null;

    // ---------- Подписка на настоящее событие Lampa.PlayerVideo 'tracks' ----------
    function tryHook() {
        try {
            if (window.Lampa && Lampa.PlayerVideo && Lampa.PlayerVideo.listener && typeof Lampa.PlayerVideo.listener.follow === 'function') {
                Lampa.PlayerVideo.listener.follow('tracks', function (e) {
                    try {
                        var tracks = e && e.tracks;
                        if (!tracks) return;
                        trackInfo = tracks.map(function (t) {
                            return { label: (t.label || '').trim(), language: (t.language || '').trim() };
                        });
                        log('Получены данные о ' + trackInfo.length + ' дорожках');
                        processElement(document.body); // перерисовать, если меню уже открыто
                    } catch (err) {
                        log('Ошибка обработки tracks: ' + err.message);
                    }
                });
                log('Подписка на Lampa.PlayerVideo "tracks" установлена');
                return true;
            }
        } catch (err) {
            log('Ошибка подписки: ' + err.message);
        }
        return false;
    }

    if (!tryHook()) {
        var attempts = 0;
        var hookIv = setInterval(function () {
            attempts++;
            if (tryHook() || attempts > 40) clearInterval(hookIv);
        }, 500);
    }

    // ---------- Замена текста в меню ----------
    function humanize(text) {
        return text.replace(/(\d+)\s*\/\s*([a-zA-Z]{2,3})\b/g, function (full, num, code) {
            var n = parseInt(num, 10);
            var info = trackInfo && trackInfo[n - 1];
            if (info && info.label) return num + ' — ' + info.label;
            var key = code.toLowerCase();
            var name = LANG_MAP[key];
            if (!name) return full;
            return num + ' — ' + name;
        });
    }

    function processElement(el) {
        if (!el || el.nodeType !== 1) return;
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        var node, toUpdate = [];
        while ((node = walker.nextNode())) {
            if (/\d+\s*\/\s*[a-zA-Z]{2,3}\b/.test(node.nodeValue)) toUpdate.push(node);
        }
        toUpdate.forEach(function (n) {
            var replaced = humanize(n.nodeValue);
            if (replaced !== n.nodeValue) n.nodeValue = replaced;
        });
    }

    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            m.addedNodes && m.addedNodes.forEach(function (node) { processElement(node); });
        });
    });

    function start() {
        observer.observe(document.body, { childList: true, subtree: true });
        processElement(document.body);
    }

    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start);
})();
