document.addEventListener('DOMContentLoaded', () => {
  const encodeProgress = document.getElementById('encodeProgress');
  const saveButton = document.getElementById('saveCapture');
  const closeButton = document.getElementById('close');
  const review = document.getElementById('review');
  const status = document.getElementById('status');
  const doctorSpeak = document.getElementById('doctorSpeak')
  const transcriptionResult = document.getElementById('transcriptionResult')
  const copyButton = document.getElementById('copy-button');
  const OPENAI_API_KEY = "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"

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
      console.log(data.text)
      transcriptionResult.innerHTML = `Transcription: ${data.text}`;
      return data.text
    } catch (error) {
      console.error("Error fetching transcription:", error);
    }
  }

  async function getDoctorSpeak(translation) {
    const prompt = `The following is a text transcription of a conversation between a physician and a patient. \n Document the facts of the transcription using appropriate medical terms. \n Do not add additional notes that were not explicitly discussed, be very concise. Do not be creative at all. Here is the text transcription: \n${translation}`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        messages: [{'role': 'user', 'content': `${prompt}`}],
        model: 'gpt-3.5-turbo',
        temperature: 0,
        max_tokens: 200
      }),
    });
    const data = await response.json();
    const medicalDocumentation = data.choices[0].message.content.trim()
    doctorSpeak.innerHTML = `Doctor Speak: ${medicalDocumentation}`;
    return medicalDocumentation
  }

  async function copyToClipboard (medicalDocumentation) {
    copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(medicalDocumentation)
      .then(() => console.log('Copied to clipboard'))
      .catch(err => console.error('Failed to copy to clipboard:', err));
    });
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
        transcription = getTranscription(file);
        getDoctorSpeak(transcription)
  
        // Download the file
        chrome.downloads.download({ url: url, filename: `${currentDate}.${format}`, saveAs: true });
      };
    }
  });
  review.onclick = () => {
    chrome.tabs.create({url: "https://chrome.google.com/webstore/detail/chrome-audio-capture/kfokdmfpdnokpmpbjhjbcabgligoelgp/reviews"});
  }


})