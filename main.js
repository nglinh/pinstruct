var mediaConstraints = {
    audio: true, // don't forget audio!
    video: true  // don't forget video!
};

navigator.mozGetUserMedia(mediaConstraints, onMediaSuccess, onMediaError);

function onMediaSuccess(stream) {
    document.getElementById("input").src = URL.createObjectURL(stream);
    window.mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.mimeType = "video/webm";
    mediaRecorder.ondataavailable = function(e) {
        if (mediaRecorder.state == 'recording'){
            mediaRecorder.stop();
            var blob = new window.Blob([e.data], {
                    type: e.data.type || self.mimeType || 'audio/ogg' // It specifies the container format as well as the audio and video capture formats.
                });            
            document.getElementById("recorded").src = window.URL.createObjectURL(blob);
            
        }
    }
    document.getElementById("start").onclick = function() {
        console.log("started");
        mediaRecorder.start();
    }
    document.getElementById("stop").onclick = function() {
        mediaRecorder.requestData();
        
    }

}

function onMediaError(e) {
    console.error('media error', e);
}