document.addEventListener('DOMContentLoaded', () => {
  const encodeProgress = document.getElementById('encodeProgress');
  const saveButton = document.getElementById('saveCapture');
  const closeButton = document.getElementById('close');
  const review = document.getElementById('review');
  const status = document.getElementById('status');
  const doctorSpeak = document.getElementById('doctorSpeak')
  const transcriptionResult = document.getElementById('transcriptionResult')
  const OPENAI_API_KEY = ""
  let format;
  let audioURL;
  let encoding = false;
  async function getTranscription(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", "whisper-1");

    try {
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      });

      const data = await response.json();
      const transcription = data.text
      transcriptionResult.innerHTML = `Transcription: ${transcription}`;
      return transcription
    } catch (error) {
      console.error("Error fetching transcription:", error);
    }
  }
  async function getDoctorSpeak(transcription) {
    const prompt = `The following is a transcription of a conversation between a physician and a patient. Document the facts of the case in appropriate medical terms. Do not add additional notes that were not explicitly discussed. Answer as if this is the OpenAI Playground.: \n${transcription}`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        messages: [{'role': 'user', 'content': `${prompt}`}],
        model: 'gpt-4-0314',
        temperature: 0,
        max_tokens: 200
      }),
    });
    const data = await response.json();
    const medicalDocumentation = data.choices[0].message.content.trim()
    doctorSpeak.innerHTML = `Doctor Speak: ${medicalDocumentation}`;
    return medicalDocumentation
  }


  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.type === "createTab") {
      format = request.format;
      let startID = request.startID;
      status.innerHTML = "Please wait..."
      closeButton.onclick = () => {
        chrome.runtime.sendMessage({cancelEncodeID: startID});
        chrome.tabs.getCurrent((tab) => {
          chrome.tabs.remove(tab.id);
        });
      }

      //if the encoding completed before the page has loaded
      if(request.audioURL) {
        encodeProgress.style.width = '100%';
        status.innerHTML = "File is ready!"
        generateSave(request.audioURL);
      } else {
        encoding = true;
      }
    }

    //when encoding completes
    if(request.type === "encodingComplete" && encoding) {
      encoding = false;
      status.innerHTML = "File is ready!";
      encodeProgress.style.width = '100%';
      generateSave(request.audioURL);
    }
    //updates encoding process bar upon messages
    if(request.type === "encodingProgress" && encoding) {
      encodeProgress.style.width = `${request.progress * 100}%`;
    }
    function generateSave(url) { //creates the save button
      const currentDate = new Date(Date.now()).toDateString();
      saveButton.onclick = () => {
        chrome.downloads.download({url: url, filename: `${currentDate}.${format}`, saveAs: true});
      };
      saveButton.style.display = "inline-block";
      saveButton.onclick = async () => {
        // Convert the audioURL to a File object
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `${currentDate}.${format}`, { type: blob.type });

        // Call the API and display the transcription result
        transcription = await getTranscription(file);
        getDoctorSpeak(transcription)
  
        // Download the file
        chrome.downloads.download({ url: url, filename: `${currentDate}.${format}`, saveAs: true });
      };
    }
  });

})