// 1. Find the elements on the page
const analyzeBtn = document.getElementById('analyze-btn');
const textArea = document.querySelector('textarea');
// 2. Add an "Event Listener" (The computer waits for a click)
analyzeBtn.addEventListener('click', function() {
    // 3. Get the text the user typed
    const userText = textArea.value;

    if (userText === "") {
        alert("Please paste some text first!");
    } else {
        alert("Analyzing: " + userText);
        console.log("Input captured: ", userText);
    }
});