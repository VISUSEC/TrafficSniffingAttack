document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素の取得 ---
    const scenarioButtons = document.querySelectorAll('.scenario-btn');
    const messageArea = document.getElementById('message-area');
    const certStatus = document.getElementById('cert-status');
    const urlText = document.getElementById('url-text');
    const siteContentWrapper = document.getElementById('site-content-wrapper');
    const packetLog = document.getElementById('packet-log');
    const modal = document.getElementById('cert-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalExplanation = document.getElementById('modal-explanation');
    const modalCloseBtn = document.querySelector('.modal-close-btn');

    // --- シナリオの定義 ---
    const scenarios = {
        1: { name: '① Free Wi-Fi + HTTP', protocol: 'http', vpn: false, dnsPoisoning: false },
        2: { name: '② Free Wi-Fi + HTTPS', protocol: 'https', vpn: false, dnsPoisoning: false },
        3: { name: '③ Free Wi-Fi + VPN/HTTP', protocol: 'http', vpn: true, dnsPoisoning: false },
        4: { name: '④ Free Wi-Fi + VPN/HTTPS', protocol: 'https', vpn: true, dnsPoisoning: false },
        5: { name: '⑤ 偽Wi-Fi + HTTPS', protocol: 'https', vpn: false, dnsPoisoning: true },
        6: { name: '⑥ 偽Wi-Fi + VPN', protocol: 'https', vpn: true, dnsPoisoning: true }
    };

    // --- アプリの状態管理 ---
    let currentState = {};
    let currentPage = 'top';

    // --- ページ描画関数 ---
    function renderPage() {
        switch (currentPage) {
            case 'top':
                siteContentWrapper.innerHTML = `
                    <div class="page-container">
                        <h2>WHR App へようこそ！</h2>
                        <p>当サービスをご利用いただきありがとうございます。</p>
                        <a href="#" id="goto-login-btn" class="page-btn">ログインページへ</a>
                    </div>
                `;
                document.getElementById('goto-login-btn').addEventListener('click', (e) => {
                    e.preventDefault();
                    navigateTo('login');
                });
                break;
            case 'login':
                siteContentWrapper.innerHTML = `
                    <div class="page-container login-form">
                        <h2>ログイン</h2>
                        <div id="login-error-container"></div>
                        <label for="username">ユーザーID (user)</label>
                        <input type="text" id="username">
                        <label for="password">パスワード (password)</label>
                        <input type="text" id="password">
                        <button id="login-submit-btn" class="page-btn">ログイン</button>
                        <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                            <button type="button" onclick="quickFill(true)" class="quick-fill-btn">
                                正しいID/Pass
                            </button>
                            <button type="button" onclick="quickFill(false)" class="quick-fill-btn">
                                誤ったID/Pass
                            </button>
                        </div>
                    </div>
                `;
                document.getElementById('login-submit-btn').addEventListener('click', handleLogin);
                const passBox = document.getElementById('password');
                if (passBox) {
                    passBox.addEventListener('keydown', function(e) {
                        // Enterキーが押されたらログインを実行
                        if (e.key === 'Enter') {
                            handleLogin(); 
                        }
                    });
                }
                break;
            case 'mypage':
                const username = (currentState.dnsPoisoning && !currentState.vpn) ? document.getElementById('username')?.value || 'user' : 'user';
                siteContentWrapper.innerHTML = `
                    <div class="page-container">
                        <h2>マイページ</h2>
                        <p>ようこそ、${username}さん！</p>
                    </div>
                `;
                break;
        }
    }

    // --- UI更新 & ナビゲーション ---
    function updateBrowserUI() {
        const path = currentPage === 'top' ? '/' : `/${currentPage}/`;
        const baseUrl = 'app.whr.jp';
        urlText.textContent = `${currentState.protocol}://${baseUrl}${path}`;

        const isHttps = currentState.protocol === 'https';
        // ブラウザから見て安全か = (HTTPS接続 かつ (DNS偽装がない または VPNがある))
        const isSecureInBrowser = isHttps && (!currentState.dnsPoisoning || currentState.vpn);

        certStatus.classList.remove('secure', 'insecure');
        if (isSecureInBrowser) {
            certStatus.textContent = '安全な通信';
            certStatus.classList.add('secure');
        } else {
            certStatus.textContent = '保護されていません';
            certStatus.classList.add('insecure');
        }

        if (currentState.dnsPoisoning && !currentState.vpn) {
            certStatus.textContent = 'プライバシーエラー';
        }
    }

    function navigateTo(page) {
        currentPage = page;
        updateBrowserUI();
        renderPage();
    }

    // --- イベント処理 ---
    scenarioButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const scenarioId = btn.dataset.scenario;
            currentState = scenarios[scenarioId];
            scenarioButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            packetLog.innerHTML = '';
            if (currentState.dnsPoisoning) {
                addPacketLog('攻撃者', 'SYSTEM', 'INFO', '偽APを起動。DNS偽装を試行中...', 'log-highlight');
            }
            messageArea.textContent = `${currentState.name}: TOPページが表示されています。「ログインページへ」ボタンを押してください。`;
            navigateTo('top');
        });
    });

    function handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const credentials = `user=${username}, pass=${password}`;
        const userIp = '192.168.1.10', siteIp = '203.0.113.88', vpnServerIp = '198.51.100.1', attackerFakeServerIp = '10.0.0.5';

        // 1. リクエスト（ユーザー→サーバー）のログを記録
        if (currentState.vpn) {
            addPacketLog(userIp, vpnServerIp, 'VPN_REQUEST', 'Encrypted Data');
        } else if (currentState.dnsPoisoning) {
            addPacketLog(userIp, attackerFakeServerIp, 'HTTPS_REQUEST (Fake Cert)', credentials, 'log-highlight');
        } else if (currentState.protocol === 'https') {
            addPacketLog(userIp, siteIp, 'HTTPS_REQUEST', '[Encrypted Application Data]', 'log-encrypted');
        } else {
            addPacketLog(userIp, siteIp, 'HTTP_REQUEST', credentials, 'log-highlight');
        }

        // 2. 認証判定
        const isCorrectCredentials = username === 'user' && password === 'password';

        // 3. レスポンス（サーバー→ユーザー）のログを記録
        if (currentState.vpn) {
            addPacketLog(vpnServerIp, userIp, 'VPN_RESPONSE', 'Encrypted Data');
        } else if (currentState.dnsPoisoning) {
            addPacketLog(attackerFakeServerIp, userIp, 'HTTPS_RESPONSE (Fake Cert)', '200 OK');
        } else if (currentState.protocol === 'https') {
            addPacketLog(siteIp, userIp, 'HTTPS_RESPONSE', '[Encrypted Server Response]', 'log-encrypted');
        } else { // HTTP
            const response = isCorrectCredentials ? '200 OK - Login Success' : '401 Unauthorized - Invalid Credentials';
            addPacketLog(siteIp, userIp, 'HTTP_RESPONSE', response, isCorrectCredentials ? '' : 'log-highlight');
        }

        // 4. UIの更新
        if (isCorrectCredentials || (currentState.dnsPoisoning && !currentState.vpn)) {
            // ログイン成功 or フィッシング成功
            navigateTo('mypage');
            if (currentState.dnsPoisoning && !currentState.vpn) {
                messageArea.textContent = '警告！偽サイトはどんなID/パスワードでもログイン成功に見せかけ、入力された情報を盗みます！';
            } else if (currentState.vpn) {
                if (currentState.dnsPoisoning) { //シナリオ6
                    messageArea.textContent = '攻撃者は偽サイトへ誘導しようとしましたが、VPNがDNS問い合わせを保護したため攻撃は失敗しました！';
                    addPacketLog('攻撃者', 'SYSTEM', 'ATTACK_LOG', 'DNS偽装失敗。ターゲットはVPNを使用中。', 'log-encrypted');
                } else { //シナリオ3,4
                    messageArea.textContent = 'VPNが通信全体を暗号化したため、攻撃者は何も盗聴できませんでした。';
                }
            } else if (currentState.protocol === 'https') { //シナリオ2
                messageArea.textContent = 'ログイン成功！HTTPSのため通信は保護されていますが、アクセス先は攻撃者に知られています。';
            } else { //シナリオ1
                messageArea.textContent = 'ログイン成功！しかしHTTP通信だったため、IDとパスワードは攻撃者に盗まれてしまいました！';
            }
        } else {
            // ログイン失敗
            const errorContainer = document.getElementById('login-error-container');
            if (errorContainer) {
                errorContainer.innerHTML = `<div class="login-error">ユーザー名またはパスワードが正しくありません。</div>`;
            }
            if (currentState.protocol === 'http') { //シナリオ1
                messageArea.textContent = 'ログインは失敗しましたが、HTTPのため、入力情報と「失敗した」という結果の両方が攻撃者に筒抜けです！';
            } else { //シナリオ2,3,4,6
                messageArea.textContent = 'ログインに失敗しました。';
            }
        }
    }

    // --- ログ追加 & モーダル ---
    function addPacketLog(src, dest, proto, content, highlightClass = '') {
        const time = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.innerHTML = `<div class="log-entry"><span class="log-time">[${time}]</span> <span class="log-source">${src}</span> &rarr; <span class="log-dest">${dest}</span><div><span class="log-protocol">${proto}:</span> <span class="log-content ${highlightClass}">${content}</span></div></div>`;
        packetLog.appendChild(logEntry);
        packetLog.scrollTop = packetLog.scrollHeight;
    }

    function showCertModal() {
        let title, body, explanation;
        const isHttps = currentState.protocol === 'https';
        const isSecureInBrowser = isHttps && (!currentState.dnsPoisoning || currentState.vpn);

        if (currentState.dnsPoisoning && !currentState.vpn) {
            title = '警告：このサイトの証明書は信頼できません！';
            body = `発行先: app.whr.jp\n発行者: Attacker's Untrusted CA (自己署名)`;
            explanation = '発行者が信頼できないため、偽サイトの危険性があります。';
        } else if (isSecureInBrowser) {
            title = 'このサイトの証明書は有効です';
            body = `発行先: app.whr.jp\n発行者: Trusted Certificate Authority`;
            explanation = '信頼できる発行者により、サイトの身元が証明されています。';
        } else {
            title = '証明書情報はありません';
            body = 'このサイトは暗号化(HTTPS)されていません。';
            explanation = '安全な接続ではないため、証明書は使用されていません。';
        }
        modalTitle.textContent = title;
        modalBody.textContent = body;
        modalExplanation.textContent = explanation;
        modal.style.display = 'flex';
    }

    certStatus.addEventListener('click', showCertModal);
    modalCloseBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === modal) modal.style.display = 'none';
    });

    // --- 初期化 ---
    document.querySelector('.scenario-btn[data-scenario="1"]').click();
});

// --- 追加機能: 入力支援ボタン ---
function quickFill(isCorrect) {
    const idBox = document.getElementById('username'); // IDのinput要素IDに合わせて変更
    const passBox = document.getElementById('password'); // パスワードのinput要素IDに合わせて変更

    if (isCorrect) {
        // 正しいパターン
        idBox.value = 'user';
        passBox.value = 'password';
    } else {
        // 誤ったパターン
        idBox.value = 'admin';
        passBox.value = '1111';
    }

    // 入力した感を出すためにパスワード欄にフォーカスを当てる（そのままEnterしやすくする）
    passBox.focus();
}