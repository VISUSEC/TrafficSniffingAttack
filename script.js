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
    const errorDialog = document.getElementById('error-dialog');
    const closeDialogBtn = document.getElementById('close-dialog-btn');

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
                        <h2>ABC App へようこそ！</h2>
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
                        <label for="username">ユーザー名 (user)</label>
                        <input type="text" id="username">
                        <label for="password">パスワード (password)</label>
                        <input type="text" id="password">
                        <button id="login-submit-btn" class="page-btn">ログイン</button>
                    </div>
                `;
                document.getElementById('login-submit-btn').addEventListener('click', handleLogin);
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
        const baseUrl = 'abc-app.com';
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
        const userIp = '192.168.1.10', siteIp = '203.0.113.88', vpnServerIp = '198.51.100.1', attackerFakeServerIp = '10.0.0.5';

        // ★★★ ログインロジックを再構築 ★★★
        
        // 1. VPN利用時 (シナリオ3, 4, 6)
        if (currentState.vpn) {
            if (username !== 'user' || password !== 'password') {
                document.getElementById('error-message').textContent = 'ユーザー名またはパスワードが正しくありません。';
                document.getElementById('error-dialog').style.display = 'flex';
                return;
            }
            addPacketLog(userIp, vpnServerIp, 'VPN_TUNNEL', 'Encrypted Data');
            navigateTo('mypage');
            
            let msg = '';
            if (currentState.dnsPoisoning) { // シナリオ6
                msg = '攻撃者は偽サイトへ誘導しようとしましたが、VPNがDNS問い合わせを保護したため攻撃は失敗しました！';
                addPacketLog('攻撃者', 'SYSTEM', 'ATTACK_LOG', 'DNS偽装失敗。ターゲットはVPNを使用中。', 'log-encrypted');
            } else { // シナリオ3, 4
                msg = 'VPNが通信全体を暗号化したため、攻撃者は何も盗聴できませんでした。';
            }
            messageArea.textContent = msg;
            return;
        }

        // 2. 偽Wi-Fi(VPNなし) = フィッシングサイト (シナリオ5)
        if (currentState.dnsPoisoning) {
            const stolenData = `user=${username}, pass=${password}`;
            addPacketLog(userIp, attackerFakeServerIp, 'HTTPS (Fake Cert)', stolenData, 'log-highlight');
            navigateTo('mypage');
            messageArea.textContent = '警告！どんなIDやパスワードでもログインできてしまいましたね。偽サイトは情報を盗むのが目的だからです！';
            return;
        }
        
        // 3. 通常のWi-Fi(VPNなし) = 本物サイト (シナリオ1, 2)
        if (username !== 'user' || password !== 'password') {
            document.getElementById('error-message').textContent = 'ユーザー名またはパスワードが正しくありません。';
            document.getElementById('error-dialog').style.display = 'flex';
            return;
        }

        navigateTo('mypage');
        if (currentState.protocol === 'https') { // シナリオ2
            addPacketLog(userIp, siteIp, 'HTTPS (TLS)', '[Encrypted Application Data]', 'log-encrypted');
            messageArea.textContent = '通信内容は暗号化されているため安全ですが、攻撃者にはどこにアクセスしたかを知られています。';
        } else { // シナリオ1
            const stolenData = `user=${username}, pass=${password}`;
            addPacketLog(userIp, siteIp, 'HTTP', stolenData, 'log-highlight');
            messageArea.textContent = '警告！HTTP通信は暗号化されていないため、IDとパスワードが丸見えです！';
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
            body = `発行先: abc-app.com\n発行者: Attacker's Untrusted CA (自己署名)`;
            explanation = '発行者が信頼できないため、偽サイトの危険性があります。';
        } else if (isSecureInBrowser) {
            title = 'このサイトの証明書は有効です';
            body = `発行先: abc-app.com\n発行者: Trusted Certificate Authority`;
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

    closeDialogBtn.addEventListener('click', () => {
        errorDialog.style.display = 'none';
    });
});