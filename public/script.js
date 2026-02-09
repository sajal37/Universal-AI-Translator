let isAuthenticated = false;
let currentUser = null;
let socket = null;
const sourceTextArea = document.getElementById('sourceTextArea');
const sourceCharCounter = document.getElementById('sourceCharCounter');
let authRequired = false;
let speechBaseText = '';
let speechSeparator = '';

// WebSocket connection flag
let useWebSocket = true;

document.addEventListener('DOMContentLoaded', function() {
    refreshAuthState();
    bindUiEvents();
    initializeThemeSwitcher();
});

function getApiMessage(data, fallbackMessage) {
    return data?.message || data?.error || fallbackMessage;
}

function getTranslatedValue(data) {
    return data?.translatedText || data?.translation || '';
}

function initializeThemeSwitcher() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Set initial theme - default to dark
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', initialTheme);
    
    const themeSwitcher = document.getElementById('themeSwitcher');
    themeSwitcher.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

function bindUiEvents() {
    sourceTextArea.addEventListener('input', () => {
        const count = sourceTextArea.value.length;
        sourceCharCounter.textContent = `${count} / 5000`;
        sourceCharCounter.classList.toggle('is-warning', count > 4500);
        
        // Emit typing event via WebSocket
        if (socket && socket.connected && isAuthenticated) {
            socket.emit('typing', { timestamp: Date.now() });
        }
    });

    sourceTextArea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            runTranslation();
        }
    });

    const focusableElements = document.querySelectorAll('input, select, textarea, button');
    focusableElements.forEach(element => {
        element.addEventListener('focus', () => element.style.transform = 'scale(1.01)');
        element.addEventListener('blur', () => element.style.transform = 'scale(1)');
    });

    document.getElementById('authLayer').addEventListener('click', function(e) {
        if (e.target === this) {
            closeAuthLayer();
        }
    });
    
    document.getElementById('speechCaptureBtn').addEventListener('click', toggleSpeechCapture);
    
    document.getElementById('fromLanguageSelect').addEventListener('change', function() {
        if (recognition && this.value !== 'auto') {
            recognition.lang = this.value;
        }
    });

    // Image upload functionality
    document.getElementById('ocrUploadBtn').addEventListener('click', () => {
        if (!isAuthenticated) {
            openAuthLayer();
            return;
        }
        document.getElementById('ocrImageInput').click();
    });

    document.getElementById('ocrImageInput').addEventListener('change', handleOcrUpload);
}

function refreshAuthState() {
    const token = localStorage.getItem('token');
    if (token) {
        const userData = readCurrentUser(); 
        if (userData) {
            isAuthenticated = true;
            currentUser = userData;
            showAccountChip();
            connectRealtimeChannel(token);
        } else {
            isAuthenticated = false;
            localStorage.removeItem('token'); 
            hideAccountChip();
        }
    } else {
        isAuthenticated = false;
        hideAccountChip();
    }
}

function readCurrentUser() {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        try {
            return JSON.parse(userData);
        } catch (e) {
            console.error('Error parsing user data:', e);
            return null;
        }
    }
    return currentUser;
}

function showAccountChip() {
    const accountChip = document.getElementById('accountChip');
    const accountAvatar = document.getElementById('accountAvatar');
    const accountName = document.getElementById('accountName');
    
    if (currentUser) {
        accountAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
        accountName.textContent = currentUser.name;
        accountChip.classList.add('active');
    }
}

function hideAccountChip() {
    document.getElementById('accountChip').classList.remove('active');
}

function openAuthLayer() {
    const overlay = document.getElementById('authLayer');
    authRequired = true;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAuthLayer() {
    if (authRequired && !isAuthenticated) {
        alert('Please sign in to continue.');
        return;
    }

    authRequired = false;
    const overlay = document.getElementById('authLayer');
    overlay.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function switchAuthMode(tab) {
    const signInTabBtn = document.getElementById('signInTabBtn');
    const signUpTabBtn = document.getElementById('signUpTabBtn');
    const signUpNameGroup = document.getElementById('signUpNameGroup');
    const signUpConfirmGroup = document.getElementById('signUpConfirmGroup');
    
    const isSignin = tab === 'signin';
    
    signInTabBtn.classList.toggle('active', isSignin);
    signUpTabBtn.classList.toggle('active', !isSignin);
    
    document.getElementById('authModalTitle').textContent = isSignin ? 'Welcome back' : 'Create account';
    document.getElementById('authModalSubtitle').textContent = isSignin ? 'Log in to keep translating' : 'Create an account to save your progress';
    document.getElementById('authSubmitAction').textContent = isSignin ? 'Sign In' : 'Sign Up';
    
    signUpNameGroup.style.display = isSignin ? 'none' : 'block';
    signUpConfirmGroup.style.display = isSignin ? 'none' : 'block';
    document.getElementById('passwordHelpLink').style.display = isSignin ? 'block' : 'none';
    
    document.getElementById('signUpNameInput').required = !isSignin;
    document.getElementById('signUpConfirmInput').required = !isSignin;
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    const isSignUp = document.getElementById('signUpTabBtn').classList.contains('active');
    const email = document.getElementById('authEmailInput').value.trim();
    const password = document.getElementById('authPasswordInput').value.trim();
    const name = document.getElementById('signUpNameInput').value.trim();
    const confirmPassword = document.getElementById('signUpConfirmInput').value.trim();
    const submitBtn = document.getElementById('authSubmitAction');

    if (!email || !password || (isSignUp && (!name || !confirmPassword))) {
        alert('Please complete all required fields.');
        return;
    }

    if (password.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
    }

    if (isSignUp && password !== confirmPassword) {
        alert('Password and confirmation do not match.');
        return;
    }

    submitBtn.textContent = isSignUp ? 'Creating account...' : 'Signing in...';
    submitBtn.disabled = true;

    try {
        const body = isSignUp
            ? { name, email, password, confirmPassword }
            : { email, password };

        const endpoint = isSignUp ? '/signup' : '/sign-in';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (response.ok) {
            const token = data.token;
            localStorage.setItem('token', token); 
            localStorage.setItem('currentUser', JSON.stringify(data.user)); 
            currentUser = data.user;
            isAuthenticated = true;
            showAccountChip();
            closeAuthLayer();
            resetAuthForm();
            
            // Initialize WebSocket after authentication
            connectRealtimeChannel(token);
        } else {
            alert(getApiMessage(data, 'Authentication failed.'));
        }
    } catch (err) {
        console.error(err);
        alert('Could not reach the server. Please try again.');
    }

    submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
    submitBtn.disabled = false;
}

function resetAuthForm() {
    document.getElementById('authForm').reset();
}

function logout() {
    if (confirm('Log out from this browser session?')) {
        isAuthenticated = false;
        currentUser = null;
        localStorage.removeItem('token'); 
        localStorage.removeItem('currentUser'); 
        hideAccountChip();
        clearWorkspaceText();
        
        // Disconnect WebSocket
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    }
}

function showPasswordHelp() {
    alert('Password reset is not available yet.');
}

// WebSocket initialization
function connectRealtimeChannel(token) {
    if (!token) return;
    
    // Load Socket.IO client
    const script = document.createElement('script');
    script.src = '/socket.io/socket.io.js';
    script.onload = () => {
        socket = io({
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        // Authenticate
        socket.emit('authenticate', token);
        
        // Authentication response
        socket.on('authenticated', (data) => {
            if (data.success) {
                console.log('WebSocket authenticated');
            } else {
                console.error('WebSocket authentication failed:', data.message);
                useWebSocket = false;
            }
        });
        
        // Handle translation queued
        socket.on('translation:queued', (data) => {
            console.log('Translation queued:', data);
            const output = document.getElementById('translatedTextArea');
            output.value = 'Working on your translation...';
        });
        
        // Handle translation completed
        socket.on('translation:completed', (data) => {
            console.log('Translation completed:', data);
            const output = document.getElementById('translatedTextArea');
            output.value = getTranslatedValue(data);
            
            const btn = document.getElementById('runTranslationBtn');
            btn.textContent = 'Translate';
            btn.disabled = false;
            btn.style.opacity = '1';
            output.classList.remove('loading');
            
            output.style.transform = 'scale(1.01)';
            setTimeout(() => { output.style.transform = 'scale(1)'; }, 300);
        });
        
        // Handle translation error
        socket.on('translation:error', (data) => {
            console.error('Translation error:', data.message);
            alert(getApiMessage(data, 'Translation failed.'));
            
            const output = document.getElementById('translatedTextArea');
            output.value = '';
            
            const btn = document.getElementById('runTranslationBtn');
            btn.textContent = 'Translate';
            btn.disabled = false;
            btn.style.opacity = '1';
            output.classList.remove('loading');
        });
        
        // Connection events
        socket.on('connect', () => {
            console.log('WebSocket connected');
        });
        
        socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
        });
        
        socket.on('reconnect', (attemptNumber) => {
            console.log('WebSocket reconnected after', attemptNumber, 'attempts');
        });
        
        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            useWebSocket = false;
        });
    };
    
    document.head.appendChild(script);
}

// Handle image upload and OCR
async function handleOcrUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please upload a valid image file.');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5 MB.');
        return;
    }

    const ocrUploadBtn = document.getElementById('ocrUploadBtn');
    const translatedTextArea = document.getElementById('translatedTextArea');
    
    ocrUploadBtn.classList.add('processing');
    ocrUploadBtn.title = 'Processing image...';
    
    // Show processing message
    translatedTextArea.value = 'Reading text from image...';
    translatedTextArea.classList.add('loading');

    try {
        // Convert image to base64
        const base64Image = await fileToDataUrl(file);

        // Extract text and translate in one step
        const token = localStorage.getItem('token');
        const targetLanguage = document.getElementById('toLanguageSelect')?.value || 'en';
        const sourceLanguage = document.getElementById('fromLanguageSelect')?.value || 'auto';

        translatedTextArea.value = 'Translating extracted text...';

        const response = await fetch('/ocr/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                imageData: base64Image,
                targetLang: targetLanguage,
                sourceLang: sourceLanguage
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Display extracted text in input
            sourceTextArea.value = data.extractedText;
            sourceTextArea.dispatchEvent(new Event('input'));

            // Display translation in output
            translatedTextArea.value = getTranslatedValue(data);
            translatedTextArea.classList.remove('loading');

            // Visual feedback
            translatedTextArea.style.transform = 'scale(1.01)';
            setTimeout(() => { translatedTextArea.style.transform = 'scale(1)'; }, 300);

            // Show confidence if low
            if (data.ocrConfidence < 70) {
                console.warn(`Low OCR confidence: ${data.ocrConfidence}%`);
                alert(`OCR confidence is ${data.ocrConfidence}%. Please quickly verify the extracted text.`);
            } else {
                console.log(`OCR Confidence: ${data.ocrConfidence}%`);
            }
        } else {
            translatedTextArea.value = '';
            translatedTextArea.classList.remove('loading');
            alert(getApiMessage(data, 'Could not process the image.'));
        }
    } catch (err) {
        console.error('Image processing error:', err);
        translatedTextArea.value = '';
        translatedTextArea.classList.remove('loading');
        alert('Image processing failed. Please try again.');
    } finally {
        ocrUploadBtn.classList.remove('processing');
        ocrUploadBtn.title = 'Upload image with text';
        // Reset file input
        event.target.value = '';
    }
}

// Convert file to base64
function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function runTranslation() {
    if (!isAuthenticated) {
        openAuthLayer();
        return;
    }

    const input = sourceTextArea.value.trim();
    const output = document.getElementById('translatedTextArea');
    const btn = document.getElementById('runTranslationBtn');
    const targetLanguage = document.getElementById('toLanguageSelect')?.value || 'en';

    if (!input) {
        output.value = '';
        return;
    }

    btn.textContent = 'Translating...';
    btn.disabled = true;
    btn.style.opacity = '0.6';
    output.classList.add('loading');
    output.value = '';

    // Use WebSocket if available and connected
    if (useWebSocket && socket && socket.connected) {
        const sourceLanguage = document.getElementById('fromLanguageSelect')?.value || 'auto';
        socket.emit('translate', { text: input, targetLang: targetLanguage, sourceLang: sourceLanguage });
        return;
    }

    // Fallback to REST API
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            openAuthLayer();
            return;
        }

        const response = await fetch('/translate', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
                text: input, 
                targetLang: targetLanguage,
                sourceLang: document.getElementById('fromLanguageSelect')?.value || 'auto'
            }) 
        });

        const data = await response.json();

        if (response.ok) {
            output.value = getTranslatedValue(data);
        } else {
            output.value = '';
            if (response.status === 401) {
                logout();
                openAuthLayer();
            } else {
                alert(getApiMessage(data, 'Translation failed.'));
            }
        }
    } catch (err) {
        output.value = '';
        alert('Could not reach the server. Please try again.');
        console.error(err);
    }

    btn.textContent = 'Translate';
    btn.disabled = false;
    btn.style.opacity = '1';
    output.classList.remove('loading');

    output.style.transform = 'scale(1.01)';
    setTimeout(() => { output.style.transform = 'scale(1)'; }, 300);
}

function clearWorkspaceText() {
    sourceTextArea.value = '';
    document.getElementById('translatedTextArea').value = '';
    sourceCharCounter.textContent = '0 / 5000';
    sourceCharCounter.classList.remove('is-warning');
}

function copyTranslatedText() {
    if (!isAuthenticated) {
        openAuthLayer();
        return;
    }
    
    const output = document.getElementById('translatedTextArea');
    const resultCopyBtn = document.getElementById('resultCopyBtn');
    
    if (output.value) {
        navigator.clipboard.writeText(output.value).then(() => {
            resultCopyBtn.textContent = 'Copied';
            resultCopyBtn.classList.add('copied');
            
            setTimeout(() => {
                resultCopyBtn.textContent = 'Copy';
                resultCopyBtn.classList.remove('copied');
            }, 2000);
        });
    }
}

// Speech recognition (keeping original functionality)
let recognition = null;
let isListening = false;

function initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onstart = () => {
            isListening = true;
            speechBaseText = sourceTextArea.value.trimEnd();
            speechSeparator = speechBaseText ? ' ' : '';
            const speechCaptureBtn = document.getElementById('speechCaptureBtn');
            speechCaptureBtn.classList.add('listening');
            speechCaptureBtn.title = 'Stop listening';
        };
        
        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
                
            sourceTextArea.value = `${speechBaseText}${speechSeparator}${transcript}`;
            sourceTextArea.dispatchEvent(new Event('input'));
        };
        
        recognition.onend = () => {
            isListening = false;
            speechBaseText = '';
            speechSeparator = '';
            const speechCaptureBtn = document.getElementById('speechCaptureBtn');
            speechCaptureBtn.classList.remove('listening');
            speechCaptureBtn.title = 'Speech to text';
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            isListening = false;
            const speechCaptureBtn = document.getElementById('speechCaptureBtn');
            speechCaptureBtn.classList.remove('listening');
            speechCaptureBtn.title = 'Speech to text';
            
            if (event.error === 'not-allowed') {
                alert('Microphone permission denied. Please allow microphone access to use speech recognition.');
            }
        };
        
        return true;
    } else {
        console.log('Speech recognition not supported');
        return false;
    }
}

function toggleSpeechCapture() {
    if (!isAuthenticated) {
        openAuthLayer();
        return;
    }
    
    if (!recognition && !initializeSpeechRecognition()) {
        alert('Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
        return;
    }
    
    if (isListening) {
        recognition.stop();
    } else {
        const fromLanguageSelect = document.getElementById('fromLanguageSelect').value;
        if (fromLanguageSelect !== 'auto') {
            recognition.lang = fromLanguageSelect;
        }
        
        try {
            recognition.start();
        } catch (error) {
            console.error('Speech recognition error', error);
        }
    }
}
