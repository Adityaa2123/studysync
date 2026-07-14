// ==========================================================================
//  GLOBAL STATE & CONFIGURATION
// ==========================================================================
let session = {
    auth_state: false,
    username: "",
    user_email: "",
    user_uid: "",
    id_token: "",
    is_admin: false,
    roadmap_list: []
};

// ==========================================================================
//  DOM ELEMENTS REGISTER
// ==========================================================================
const dom = {
    // Toast Container
    toastContainer: document.getElementById('toast-container'),

    // Authentication Elements
    authSection: document.getElementById('auth-section'),
    authCard: document.querySelector('.auth-card'),
    authForm: document.getElementById('auth-form'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    authSpinner: document.getElementById('auth-spinner'),
    usernameGroup: document.getElementById('username-group'),
    emailGroup: document.getElementById('email-group'),
    authUsername: document.getElementById('auth-username'),
    authEmail: document.getElementById('auth-email'),
    authPassword: document.getElementById('auth-password'),
    togglePasswordBtn: document.getElementById('toggle-password-btn'),
    radioLogin: document.getElementById('mode-login'),
    radioSignup: document.getElementById('mode-signup'),
    radioAdmin: document.getElementById('mode-admin'),
    slider: document.querySelector('.segment-slider'),

    // App Workspace Elements
    workspaceSection: document.getElementById('workspace-section'),
    userProfileWidget: document.getElementById('user-profile-widget'),
    displayUsername: document.getElementById('display-username'),
    displayRole: document.getElementById('display-role'),
    logoutBtn: document.getElementById('logout-btn'),

    // Navigation Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Admin Dashboard
    adminPanel: document.getElementById('admin-panel'),
    usersTableBody: document.getElementById('users-table-body'),
    inspectSelect: document.getElementById('inspect-select'),
    inspectLoadBtn: document.getElementById('inspect-load-btn'),
    inspectResultsArea: document.getElementById('inspect-results-area'),
    inspectTableBody: document.getElementById('inspect-table-body'),

    // Configuration/Upload Panel
    dragDropZone: document.getElementById('drag-drop-zone'),
    syllabusInput: document.getElementById('syllabus-input'),
    uploaderContents: document.getElementById('uploader-contents'),
    uploaderActiveFile: document.getElementById('uploader-active-file'),
    selectedFileName: document.getElementById('selected-file-name'),
    selectedFileSize: document.getElementById('selected-file-size'),
    removeFileBtn: document.getElementById('remove-file-btn'),
    studyStartTime: document.getElementById('study-start-time'),
    studyEndTime: document.getElementById('study-end-time'),
    generateRoadmapBtn: document.getElementById('generate-roadmap-btn'),
    generateSpinner: document.getElementById('generate-spinner'),

    // Calendar Elements
    calendarEmpty: document.getElementById('calendar-empty'),
    calendarListArea: document.getElementById('calendar-list-area'),

    // Roadmap Elements
    roadmapEmpty: document.getElementById('roadmap-empty'),
    roadmapContentArea: document.getElementById('roadmap-content-area'),
    progressSummaryText: document.getElementById('progress-summary-text'),
    progressPercentText: document.getElementById('progress-percent-text'),
    progressTrackFill: document.getElementById('progress-track-fill'),
    saveRoadmapBtn: document.getElementById('save-roadmap-btn'),
    downloadCsvBtn: document.getElementById('download-csv-btn'),
    roadmapChecklistContainer: document.getElementById('roadmap-checklist-container')
};

// Active uploaded file storage
let uploadedFileObject = null;

// ==========================================================================
//  TOAST UTILITY SYSTEM
// ==========================================================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;
    
    dom.toastContainer.appendChild(toast);
    
    // Automatically trigger fade out
    setTimeout(() => {
        toast.classList.add('toast-fadeout');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3500);
}

// ==========================================================================
//  INITIALIZATION & STATE SYNCHRONIZER
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadLocalSession();
    registerEventListeners();
    initCursorGlow();
    initGalaxy();
    
    if (!session.auth_state) {
        document.body.classList.add('auth-active');
    }
});

// Shared mouse coordinate state for tracking animations
const mouse = { x: null, y: null };

function initCursorGlow() {
    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);
    
    const aurora = document.getElementById('login-aurora-bg');

    window.addEventListener('mousemove', (e) => {
        // Track mouse coordinates globally
        mouse.x = e.clientX;
        mouse.y = e.clientY;

        // Center the 350px wide glow element on the mouse coordinates
        glow.style.transform = `translate3d(${e.clientX - 175}px, ${e.clientY - 175}px, 0)`;

        // Parallax background shift on login page cursor movements
        if (aurora && document.body.classList.contains('auth-active')) {
            const moveX = (e.clientX - window.innerWidth / 2) * -0.06; // 6% offset
            const moveY = (e.clientY - window.innerHeight / 2) * -0.06;
            aurora.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
        }
    });

    document.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
        glow.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
        glow.style.opacity = '1';
    });
}

function initGalaxy() {
    const canvas = document.getElementById('galaxy-canvas');
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) || 
               canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) {
        console.error('WebGL not supported');
        return;
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    const vsSource = `
        attribute vec2 position;
        attribute vec2 uv;
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    const fsSource = `
        precision highp float;

        uniform float uTime;
        uniform vec3 uResolution;
        uniform vec2 uFocal;
        uniform vec2 uRotation;
        uniform float uStarSpeed;
        uniform float uDensity;
        uniform float uHueShift;
        uniform float uSpeed;
        uniform vec2 uMouse;
        uniform float uGlowIntensity;
        uniform float uSaturation;
        uniform bool uMouseRepulsion;
        uniform float uTwinkleIntensity;
        uniform float uRotationSpeed;
        uniform float uRepulsionStrength;
        uniform float uMouseActiveFactor;
        uniform float uAutoCenterRepulsion;
        uniform bool uTransparent;

        varying vec2 vUv;

        #define NUM_LAYER 4.0
        #define STAR_COLOR_CUTOFF 0.2
        #define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
        #define PERIOD 3.0

        float Hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        float tri(float x) {
            return abs(fract(x) * 2.0 - 1.0);
        }

        float tris(float x) {
            float t = fract(x);
            return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
        }

        float trisn(float x) {
            float t = fract(x);
            return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
        }

        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        float Star(vec2 uv, float flare) {
            float d = length(uv);
            float m = (0.05 * uGlowIntensity) / d;
            float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
            m += rays * flare * uGlowIntensity;
            uv *= MAT45;
            rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
            m += rays * 0.3 * flare * uGlowIntensity;
            m *= smoothstep(1.0, 0.2, d);
            return m;
        }

        vec3 StarLayer(vec2 uv) {
            vec3 col = vec3(0.0);

            vec2 gv = fract(uv) - 0.5;
            vec2 id = floor(uv);

            for (int y = -1; y <= 1; y++) {
                for (int x = -1; x <= 1; x++) {
                    vec2 offset = vec2(float(x), float(y));
                    vec2 si = id + vec2(float(x), float(y));
                    float seed = Hash21(si);
                    float size = fract(seed * 345.32);
                    float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));
                    float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

                    float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
                    float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
                    float grn = min(red, blu) * seed;
                    vec3 base = vec3(red, grn, blu);

                    float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
                    hue = fract(hue + uHueShift / 360.0);
                    float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
                    float val = max(max(base.r, base.g), base.b);
                    base = hsv2rgb(vec3(hue, sat, val));

                    vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;

                    float star = Star(gv - offset - pad, flareSize);
                    vec3 color = base;

                    float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
                    twinkle = mix(1.0, twinkle, uTwinkleIntensity);
                    star *= twinkle;

                    col += star * size * color;
                }
            }

            return col;
        }

        void main() {
            vec2 focalPx = uFocal * uResolution.xy;
            vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;

            vec2 mouseNorm = uMouse - vec2(0.5);

            if (uAutoCenterRepulsion > 0.0) {
                vec2 centerUV = vec2(0.0, 0.0);
                float centerDist = length(uv - centerUV);
                vec2 repulsion = normalize(uv - centerUV) * (uAutoCenterRepulsion / (centerDist + 0.1));
                uv += repulsion * 0.05;
            } else if (uMouseRepulsion) {
                vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;
                float mouseDist = length(uv - mousePosUV);
                vec2 repulsion = normalize(uv - mousePosUV) * (uRepulsionStrength / (mouseDist + 0.1));
                uv += repulsion * 0.05 * uMouseActiveFactor;
            } else {
                vec2 mouseOffset = mouseNorm * 0.1 * uMouseActiveFactor;
                uv += mouseOffset;
            }

            float autoRotAngle = uTime * uRotationSpeed;
            mat2 autoRot = mat2(cos(autoRotAngle), -sin(autoRotAngle), sin(autoRotAngle), cos(autoRotAngle));
            uv = autoRot * uv;

            uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;

            vec3 col = vec3(0.0);

            for (int i = 0; i < 4; i++) {
                float fi = float(i) * 0.25;
                float depth = fract(fi + uStarSpeed * uSpeed);
                float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
                float fade = depth * smoothstep(1.0, 0.9, depth);
                col += StarLayer(uv * scale + fi * 453.32) * fade;
            }

            if (uTransparent) {
                float alpha = length(col);
                alpha = smoothstep(0.0, 0.3, alpha);
                alpha = min(alpha, 1.0);
                gl_FragColor = vec4(col, alpha);
            } else {
                gl_FragColor = vec4(col, 1.0);
            }
        }
    `;

    function compileShader(source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return;
    }

    // Geometry - Full-screen triangle covering the viewport
    const vertices = new Float32Array([
        -1.0, -1.0,  0.0,  0.0,
         3.0, -1.0,  2.0,  0.0,
        -1.0,  3.0,  0.0,  2.0,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    const uvLoc = gl.getAttribLocation(program, 'uv');

    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);

    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

    const uniforms = {
        uTime: gl.getUniformLocation(program, 'uTime'),
        uResolution: gl.getUniformLocation(program, 'uResolution'),
        uFocal: gl.getUniformLocation(program, 'uFocal'),
        uRotation: gl.getUniformLocation(program, 'uRotation'),
        uStarSpeed: gl.getUniformLocation(program, 'uStarSpeed'),
        uDensity: gl.getUniformLocation(program, 'uDensity'),
        uHueShift: gl.getUniformLocation(program, 'uHueShift'),
        uSpeed: gl.getUniformLocation(program, 'uSpeed'),
        uMouse: gl.getUniformLocation(program, 'uMouse'),
        uGlowIntensity: gl.getUniformLocation(program, 'uGlowIntensity'),
        uSaturation: gl.getUniformLocation(program, 'uSaturation'),
        uMouseRepulsion: gl.getUniformLocation(program, 'uMouseRepulsion'),
        uTwinkleIntensity: gl.getUniformLocation(program, 'uTwinkleIntensity'),
        uRotationSpeed: gl.getUniformLocation(program, 'uRotationSpeed'),
        uRepulsionStrength: gl.getUniformLocation(program, 'uRepulsionStrength'),
        uMouseActiveFactor: gl.getUniformLocation(program, 'uMouseActiveFactor'),
        uAutoCenterRepulsion: gl.getUniformLocation(program, 'uAutoCenterRepulsion'),
        uTransparent: gl.getUniformLocation(program, 'uTransparent')
    };

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initial constant uniforms settings from screenshot
    const starSpeed = 0.6;
    const animationSpeed = 3.0; // uSpeed

    let startTime = performance.now();

    function animate(now) {
        requestAnimationFrame(animate);

        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);

        const time = (now - startTime) * 0.001;

        // uStarSpeed updates progressively based on time and starSpeed
        const starSpeedUniformValue = (time * starSpeed) / 10.0;

        gl.uniform1f(uniforms.uTime, time);
        gl.uniform3f(uniforms.uResolution, canvas.width, canvas.height, canvas.width / canvas.height);
        gl.uniform2f(uniforms.uFocal, 0.5, 0.5);
        gl.uniform2f(uniforms.uRotation, 1.0, 0.0);
        gl.uniform1f(uniforms.uStarSpeed, starSpeedUniformValue);
        gl.uniform1f(uniforms.uDensity, 1.0);
        gl.uniform1f(uniforms.uHueShift, 140.0);
        gl.uniform1f(uniforms.uSpeed, animationSpeed);
        if (mouse.x !== null && mouse.y !== null) {
            const mx = mouse.x / canvas.width;
            const my = 1.0 - (mouse.y / canvas.height); // Invert Y for WebGL coords
            gl.uniform2f(uniforms.uMouse, mx, my);
            gl.uniform1i(uniforms.uMouseRepulsion, 1);
            gl.uniform1f(uniforms.uMouseActiveFactor, 1.0);
        } else {
            gl.uniform2f(uniforms.uMouse, 0.5, 0.5);
            gl.uniform1i(uniforms.uMouseRepulsion, 0);
            gl.uniform1f(uniforms.uMouseActiveFactor, 0.0);
        }
        gl.uniform1f(uniforms.uGlowIntensity, 0.4);
        gl.uniform1f(uniforms.uSaturation, 1.0);
        gl.uniform1f(uniforms.uTwinkleIntensity, 0.3);
        gl.uniform1f(uniforms.uRotationSpeed, 0.15);
        gl.uniform1f(uniforms.uRepulsionStrength, 1.0);
        gl.uniform1f(uniforms.uAutoCenterRepulsion, 0.0);
        gl.uniform1i(uniforms.uTransparent, 1);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(animate);
}

function loadLocalSession() {
    const saved = localStorage.getItem('study_sync_session');
    if (saved) {
        try {
            session = JSON.parse(saved);
            if (session.auth_state) {
                applyAuthorizedState();
            }
        } catch (e) {
            localStorage.removeItem('study_sync_session');
        }
    }
}

function saveLocalSession() {
    localStorage.setItem('study_sync_session', JSON.stringify(session));
}

function applyAuthorizedState() {
    document.body.classList.remove('auth-active');
    // Display header widget
    dom.displayUsername.textContent = session.username;
    dom.displayRole.textContent = session.is_admin ? "Control Root Admin" : "Active Student Profile";
    dom.userProfileWidget.style.display = 'flex';
    
    // Hide auth, show workspace
    dom.authSection.style.display = 'none';
    dom.workspaceSection.style.display = 'block';

    // Check if admin panel should be active
    if (session.is_admin) {
        dom.adminPanel.style.display = 'block';
        fetchAdminUsers();
    } else {
        dom.adminPanel.style.display = 'none';
    }

    // Load active views
    renderCalendar();
    renderRoadmapChecklist();
}

function applyLoggedOutState() {
    document.body.classList.add('auth-active');
    dom.userProfileWidget.style.display = 'none';
    dom.workspaceSection.style.display = 'none';
    dom.authSection.style.display = 'flex';
    
    // Reset forms
    dom.authUsername.value = '';
    dom.authEmail.value = '';
    dom.authPassword.value = '';
    uploadedFileObject = null;
    updateFileUploaderUI();
    
    session = {
        auth_state: false,
        username: "",
        user_email: "",
        user_uid: "",
        id_token: "",
        is_admin: false,
        roadmap_list: []
    };
    saveLocalSession();
}

// ==========================================================================
//  EVENT REGISTRATION
// ==========================================================================
function registerEventListeners() {
    // Auth radio mode toggles
    dom.radioLogin.addEventListener('change', updateAuthFormFields);
    dom.radioSignup.addEventListener('change', updateAuthFormFields);
    dom.radioAdmin.addEventListener('change', updateAuthFormFields);

    // Password Toggle Button
    dom.togglePasswordBtn.addEventListener('click', togglePasswordVisibility);

    // Submit Auth Form
    dom.authForm.addEventListener('submit', handleAuthSubmit);

    // Logout
    dom.logoutBtn.addEventListener('click', applyLoggedOutState);

    // Workspace tab switching
    dom.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            switchWorkspaceTab(targetTab);
        });
    });

    // Drag-and-drop file uploader triggers
    ['dragenter', 'dragover'].forEach(eventName => {
        dom.dragDropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dom.dragDropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dom.dragDropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dom.dragDropZone.classList.remove('dragover');
        }, false);
    });

    dom.dragDropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleSelectedFile(files[0]);
        }
    });

    dom.syllabusInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    dom.removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadedFileObject = null;
        dom.syllabusInput.value = '';
        updateFileUploaderUI();
    });

    // Roadmap Generation
    dom.generateRoadmapBtn.addEventListener('click', handleRoadmapGeneration);

    // Save Progress Button
    dom.saveRoadmapBtn.addEventListener('click', handleSaveRoadmap);

    // Download CSV
    dom.downloadCsvBtn.addEventListener('click', handleDownloadCsv);

    // Admin Inspect Control Load
    dom.inspectLoadBtn.addEventListener('click', handleAdminInspectLoad);
}

// ==========================================================================
//  AUTH SCREEN METHODS
// ==========================================================================
function updateAuthFormFields() {
    if (dom.radioLogin.checked) {
        dom.usernameGroup.style.display = 'flex';
        dom.emailGroup.style.display = 'flex';
        dom.authSubmitBtn.querySelector('span').textContent = 'Sign In';
    } else if (dom.radioSignup.checked) {
        dom.usernameGroup.style.display = 'flex';
        dom.emailGroup.style.display = 'flex';
        dom.authSubmitBtn.querySelector('span').textContent = 'Create Profile';
    } else if (dom.radioAdmin.checked) {
        dom.usernameGroup.style.display = 'none';
        dom.emailGroup.style.display = 'flex';
        dom.authSubmitBtn.querySelector('span').textContent = 'Admin Login';
    }
}

function togglePasswordVisibility() {
    if (dom.authPassword.type === 'password') {
        dom.authPassword.type = 'text';
        dom.togglePasswordBtn.classList.add('active');
    } else {
        dom.authPassword.type = 'password';
        dom.togglePasswordBtn.classList.remove('active');
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    // UI Loading state
    dom.authSubmitBtn.disabled = true;
    dom.authSpinner.style.display = 'block';

    const username = dom.authUsername.value.trim();
    const email = dom.authEmail.value.trim();
    const password = dom.authPassword.value;

    let endpoint = '/api/auth/login';
    let payload = {};

    if (dom.radioLogin.checked) {
        endpoint = '/api/auth/login';
        payload = { username, email, password };
    } else if (dom.radioSignup.checked) {
        endpoint = '/api/auth/signup';
        payload = { username, email, password };
    } else if (dom.radioAdmin.checked) {
        endpoint = '/api/auth/admin-login';
        payload = { email, password };
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();

        if (response.ok && resData.success) {
            session.auth_state = true;
            session.username = resData.username;
            session.user_email = resData.email;
            session.user_uid = resData.uid || '';
            session.id_token = resData.idToken;
            session.is_admin = resData.isAdmin || false;
            session.roadmap_list = resData.roadmap_list || [];

            saveLocalSession();
            applyAuthorizedState();
            showToast(`Welcome back, ${session.username}!`, 'success');
        } else {
            showToast(resData.message || 'Authentication failed. Please verify credentials.', 'error');
        }
    } catch (err) {
        showToast('Network error: Server is currently unreachable.', 'error');
    } finally {
        dom.authSubmitBtn.disabled = false;
        dom.authSpinner.style.display = 'none';
    }
}

// ==========================================================================
//  NAVIGATION MODULE
// ==========================================================================
function switchWorkspaceTab(targetTabId) {
    // Set active tab buttons
    dom.tabBtns.forEach(btn => {
        if (btn.getAttribute('data-tab') === targetTabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Toggle active tab content blocks
    dom.tabContents.forEach(content => {
        if (content.id === targetTabId) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

// ==========================================================================
//  FILE UPLOAD COMPONENT METHODS
// ==========================================================================
function handleSelectedFile(file) {
    if (file.type !== 'application/pdf') {
        showToast('Invalid file format. Please upload a PDF syllabus.', 'error');
        return;
    }
    uploadedFileObject = file;
    updateFileUploaderUI();
}

function updateFileUploaderUI() {
    if (uploadedFileObject) {
        // Display active file block
        dom.selectedFileName.textContent = uploadedFileObject.name;
        
        // Format size
        const kbSize = (uploadedFileObject.size / 1024).toFixed(1);
        dom.selectedFileSize.textContent = `${kbSize} KB`;
        
        dom.uploaderContents.style.display = 'none';
        dom.uploaderActiveFile.style.display = 'flex';
        dom.dragDropZone.style.borderColor = 'var(--border-focus)';
    } else {
        // Reset to default
        dom.uploaderContents.style.display = 'flex';
        dom.uploaderActiveFile.style.display = 'none';
        dom.dragDropZone.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    }
}

// ==========================================================================
//  AI ROADMAP COMPILER & API CONNECTIONS
// ==========================================================================
async function handleRoadmapGeneration() {
    if (!uploadedFileObject) {
        showToast('Please upload a course syllabus PDF document first.', 'error');
        return;
    }

    // Set loading triggers
    dom.generateRoadmapBtn.disabled = true;
    dom.generateSpinner.style.display = 'block';
    dom.generateRoadmapBtn.querySelector('span').textContent = 'Analyzing syllabus payload...';

    const formData = new FormData();
    formData.append('file', uploadedFileObject);
    formData.append('start_time', dom.studyStartTime.value);
    formData.append('end_time', dom.studyEndTime.value);
    formData.append('username', session.username);
    formData.append('email', session.user_email);

    try {
        const response = await fetch('/api/generate-roadmap', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.id_token}`
            },
            body: formData
        });

        const resData = await response.json();

        if (response.ok && resData.success) {
            session.roadmap_list = resData.roadmap;
            saveLocalSession();
            
            // Re-render views
            renderCalendar();
            renderRoadmapChecklist();
            
            showToast('AI Roadmap generated and synchronized successfully!', 'success');
            // Go to Roadmap checklist
            switchWorkspaceTab('tab-roadmap');
        } else {
            showToast(resData.message || 'Roadmap generation failed. Please review PDF format.', 'error');
        }
    } catch (err) {
        showToast('Failed to contact generation nodes. Please try again.', 'error');
    } finally {
        dom.generateRoadmapBtn.disabled = false;
        dom.generateSpinner.style.display = 'none';
        dom.generateRoadmapBtn.querySelector('span').textContent = 'Generate Complete Roadmap';
    }
}

// ==========================================================================
//  CALENDAR RENDER MODULE
// ==========================================================================
function renderCalendar() {
    const list = session.roadmap_list || [];
    
    if (list.length === 0) {
        dom.calendarEmpty.style.display = 'block';
        dom.calendarListArea.style.display = 'none';
        dom.calendarListArea.innerHTML = '';
        return;
    }

    dom.calendarEmpty.style.display = 'none';
    dom.calendarListArea.style.display = 'flex';
    
    let htmlContent = '';
    list.forEach(item => {
        const isCompleted = item.Status === true;
        const statusText = isCompleted ? 'Completed' : 'Pending';
        const badgeClass = isCompleted ? 'completed' : 'pending';

        htmlContent += `
            <div class="calendar-event-card">
                <div class="event-date-box">
                    <span class="event-date">🗓️ ${item["Scheduled Date"]}</span>
                    <span class="event-time">⏱️ ${item["Time Slot"]}</span>
                </div>
                <div class="event-topic-box">
                    <span class="event-topic">🪐 Focus Topic: ${item["Focus Topic"]}</span>
                    <span class="event-activity">Suggested Study Activity: ${item["Suggested Activity"]}</span>
                </div>
                <div class="event-status-box">
                    <span class="status-badge ${badgeClass}">${statusText}</span>
                </div>
            </div>
        `;
    });
    
    dom.calendarListArea.innerHTML = htmlContent;
}

// ==========================================================================
//  ROADMAP RENDER MODULE
// ==========================================================================
function renderRoadmapChecklist() {
    const list = session.roadmap_list || [];
    
    if (list.length === 0) {
        dom.roadmapEmpty.style.display = 'block';
        dom.roadmapContentArea.style.display = 'none';
        dom.roadmapChecklistContainer.innerHTML = '';
        return;
    }

    dom.roadmapEmpty.style.display = 'none';
    dom.roadmapContentArea.style.display = 'block';

    let htmlContent = '';
    let completedCount = 0;

    list.forEach((item, index) => {
        const isChecked = item.Status === true;
        if (isChecked) completedCount++;

        htmlContent += `
            <label class="checklist-item ${isChecked ? 'active-item' : ''}" data-index="${index}">
                <div class="checkbox-container">
                    <input type="checkbox" class="roadmap-checkbox" data-index="${index}" ${isChecked ? 'checked' : ''}>
                    <span class="checkmark-circle"></span>
                </div>
                <div class="checklist-text-area">
                    <span class="checklist-title">${item["Focus Topic"]}</span>
                    <span class="checklist-meta">
                        🗓️ Scheduled Date: <strong>${item["Scheduled Date"]}</strong> &nbsp;|&nbsp; 
                        ⏱️ Time Slot: <strong>${item["Time Slot"]}</strong> &nbsp;|&nbsp; 
                        📡 Activity: <strong>${item["Suggested Activity"]}</strong>
                    </span>
                </div>
            </label>
        `;
    });

    dom.roadmapChecklistContainer.innerHTML = htmlContent;
    updateProgressBar(completedCount, list.length);

    // Register checkbox listener
    const checkboxes = dom.roadmapChecklistContainer.querySelectorAll('.roadmap-checkbox');
    checkboxes.forEach(box => {
        box.addEventListener('change', handleCheckboxToggle);
    });
}

function updateProgressBar(completed, total) {
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    dom.progressSummaryText.textContent = `${completed}/${total} Milestones Completed`;
    dom.progressPercentText.textContent = `${pct}%`;
    dom.progressTrackFill.style.width = `${pct}%`;
}

function handleCheckboxToggle(e) {
    const index = parseInt(e.target.getAttribute('data-index'));
    const isChecked = e.target.checked;
    
    // Update active-item class layout
    const labelCard = dom.roadmapChecklistContainer.querySelector(`.checklist-item[data-index="${index}"]`);
    if (isChecked) {
        labelCard.classList.add('active-item');
    } else {
        labelCard.classList.remove('active-item');
    }

    // Update state
    session.roadmap_list[index].Status = isChecked;
    saveLocalSession();
    
    // Recalculate progress bars
    const total = session.roadmap_list.length;
    const completed = session.roadmap_list.filter(item => item.Status === true).length;
    updateProgressBar(completed, total);
    
    // Trigger calendar badge updates
    renderCalendar();
}

// ==========================================================================
//  SAVE ROADMAP & CLIENT-SIDE CSV EXPORTER
// ==========================================================================
async function handleSaveRoadmap() {
    dom.saveRoadmapBtn.disabled = true;
    
    try {
        const response = await fetch('/api/save-roadmap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.id_token}`
            },
            body: JSON.stringify({
                username: session.username,
                email: session.user_email,
                roadmap_list: session.roadmap_list
            })
        });

        const resData = await response.json();

        if (response.ok && resData.success) {
            showToast('Progress saved successfully to Firestore!', 'success');
        } else {
            showToast(resData.message || 'Failed to save progress.', 'error');
        }
    } catch (err) {
        showToast('Error syncing roadmap data with server.', 'error');
    } finally {
        dom.saveRoadmapBtn.disabled = false;
    }
}

function handleDownloadCsv() {
    const list = session.roadmap_list || [];
    if (list.length === 0) return;

    // Build CSV Content
    const headers = ['Scheduled Date', 'Time Slot', 'Focus Topic', 'Suggested Activity', 'Status'];
    const rows = list.map(item => [
        `"${item["Scheduled Date"]}"`,
        `"${item["Time Slot"]}"`,
        `"${item["Focus Topic"]}"`,
        `"${item["Suggested Activity"]}"`,
        item.Status ? 'Completed' : 'Pending'
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
    ].join('\n');

    // Create Download Blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${session.username}_study_roadmap.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Spreadsheet download triggered.', 'success');
}

// ==========================================================================
//  ADMIN MODULE FUNCTIONS
// ==========================================================================
async function fetchAdminUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${session.id_token}`
            }
        });

        const resData = await response.json();

        if (response.ok && resData.success) {
            renderAdminUsersTable(resData.users);
            populateInspectDropdown(resData.users);
        }
    } catch (err) {
        console.error('Failed to load administrator directory records.', err);
    }
}

function renderAdminUsersTable(users) {
    if (!users || users.length === 0) {
        dom.usersTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No users registered.</td></tr>';
        return;
    }

    let html = '';
    users.forEach(user => {
        html += `
            <tr>
                <td><strong>${user.username}</strong></td>
                <td>${user.email}</td>
                <td><span style="color:var(--apple-blue); font-weight:600;">${user.milestones_count} Milestones</span></td>
            </tr>
        `;
    });
    dom.usersTableBody.innerHTML = html;
}

function populateInspectDropdown(users) {
    // Clear old options except placeholder
    dom.inspectSelect.innerHTML = '<option value="" disabled selected>Select user profile...</option>';
    
    users.forEach(user => {
        const opt = document.createElement('option');
        opt.value = user.username;
        opt.textContent = user.username;
        dom.inspectSelect.appendChild(opt);
    });
}

async function handleAdminInspectLoad() {
    const selectedUser = dom.inspectSelect.value;
    if (!selectedUser) {
        showToast('Please select a target user profile to inspect.', 'info');
        return;
    }

    dom.inspectLoadBtn.disabled = true;

    try {
        const response = await fetch('/api/admin/load-roadmap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.id_token}`
            },
            body: JSON.stringify({ username: selectedUser })
        });

        const resData = await response.json();

        if (response.ok && resData.success) {
            renderInspectRoadmapTable(resData.roadmap);
        } else {
            showToast('Failed to load target database roadmap records.', 'error');
        }
    } catch (err) {
        showToast('Error fetching target database records.', 'error');
    } finally {
        dom.inspectLoadBtn.disabled = false;
    }
}

function renderInspectRoadmapTable(roadmap) {
    if (!roadmap || roadmap.length === 0) {
        dom.inspectResultsArea.style.display = 'none';
        dom.inspectTableBody.innerHTML = '';
        showToast('Selected user has no active roadmap records.', 'info');
        return;
    }

    let html = '';
    roadmap.forEach(item => {
        const statusText = item.Status ? '✓ Completed' : 'Pending';
        const color = item.Status ? 'var(--apple-green)' : 'var(--text-secondary)';
        
        html += `
            <tr>
                <td>${item["Scheduled Date"]}</td>
                <td><code>${item["Time Slot"]}</code></td>
                <td><strong>${item["Focus Topic"]}</strong></td>
                <td>${item["Suggested Activity"]}</td>
                <td><span style="color:${color}; font-weight:600;">${statusText}</span></td>
            </tr>
        `;
    });

    dom.inspectTableBody.innerHTML = html;
    dom.inspectResultsArea.style.display = 'block';
    showToast('Target milestones matrix loaded successfully.', 'success');
}
