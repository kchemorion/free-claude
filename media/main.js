// Get VS Code API
const vscode = acquireVsCodeApi();

// Elements
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const clearButton = document.getElementById('clear-button');

// State
let messages = [];

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;

    switch (message.command) {
        case 'updateState':
            messages = message.messages;
            updateMessagesView();
            break;
        case 'error':
            showError(message.content);
            break;
    }
});

// Send message
function sendMessage() {
    const text = userInput.value.trim();
    if (text) {
        vscode.postMessage({
            command: 'sendMessage',
            text: text
        });
        userInput.value = '';
        userInput.style.height = 'auto';
    }
}

// Clear conversation
function clearConversation() {
    vscode.postMessage({
        command: 'clearConversation'
    });
}

// Update messages view
function updateMessagesView() {
    messagesContainer.innerHTML = '';
    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        contentDiv.innerHTML = msg.content;
        
        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'timestamp';
        timestampDiv.textContent = new Date(msg.timestamp).toLocaleTimeString();
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timestampDiv);
        messagesContainer.appendChild(messageDiv);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show error
function showError(content) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message error';
    errorDiv.textContent = content;
    messagesContainer.appendChild(errorDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Auto-resize textarea
function autoResize() {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
}

// Event listeners
sendButton.addEventListener('click', sendMessage);
clearButton.addEventListener('click', clearConversation);

userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

userInput.addEventListener('input', autoResize);
