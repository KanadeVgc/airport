【JS】
function showMain() {
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('detail-page').classList.add('hidden');
    window.scrollTo(0, 0);
}

// 進入編輯室報告
function showReport() {
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('detail-page').classList.remove('hidden');
    document.getElementById('report-full').classList.remove('hidden');
    document.getElementById('article1-full').classList.add('hidden');
    window.scrollTo(0, 0);
}

// 進入專題內容
function showArticle() {
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('detail-page').classList.remove('hidden');
    document.getElementById('article1-full').classList.remove('hidden');
    document.getElementById('report-full').classList.add('hidden');
    window.scrollTo(0, 0);
}
