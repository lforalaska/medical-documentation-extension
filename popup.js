let interval;
let timeLeft;

const displayStatus = function () {
  //function to handle the display of time and buttons
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const status = document.getElementById("status");
    const timeRem = document.getElementById("timeRem");
    const startButton = document.getElementById("start");
    const finishButton = document.getElementById("finish");
    const cancelButton = document.getElementById("cancel");
    //CODE TO BLOCK CAPTURE ON YOUTUBE, DO NOT DELETE
    // if(tabs[0].url.toLowerCase().includes("youtube")) {
    //   status.innerHTML = "Capture is disabled on this site due to copyright";
    // } else {
    chrome.runtime.sendMessage({ currentTab: tabs[0].id }, (response) => {
      if (response) {
        chrome.storage.sync.get(
          {
            maxTime: 1200000,
            limitRemoved: false,
          },
          (options) => {
            if (options.maxTime > 1200000) {
              chrome.storage.sync.set({
                maxTime: 1200000,
              });
              timeLeft = 1200000 - (Date.now() - response);
            } else {
              timeLeft = options.maxTime - (Date.now() - response);
            }
            status.innerHTML = "Tab is currently being captured";
            if (options.limitRemoved) {
              timeRem.innerHTML = `${parseTime(Date.now() - response)}`;
              interval = setInterval(() => {
                timeRem.innerHTML = `${parseTime(Date.now() - response)}`;
              });
            } else {
              timeRem.innerHTML = `${parseTime(timeLeft)} remaining`;
              interval = setInterval(() => {
                timeLeft = timeLeft - 1000;
                timeRem.innerHTML = `${parseTime(timeLeft)} remaining`;
              }, 1000);
            }
          }
        );
        finishButton.style.display = "block";
        cancelButton.style.display = "block";
      } else {
        startButton.style.display = "block";
      }
    });
    // }
  });
};

const parseTime = function (time) {
  //function to display time remaining or time elapsed
  let minutes = Math.floor(time / 1000 / 60);
  let seconds = Math.floor((time / 1000) % 60);
  if (minutes < 10 && minutes >= 0) {
    minutes = "0" + minutes;
  } else if (minutes < 0) {
    minutes = "00";
  }
  if (seconds < 10 && seconds >= 0) {
    seconds = "0" + seconds;
  } else if (seconds < 0) {
    seconds = "00";
  }
  return `${minutes}:${seconds}`;
};

//manipulation of the displayed buttons upon message from background
chrome.runtime.onMessage.addListener((request, sender) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const status = document.getElementById("status");
    const timeRem = document.getElementById("timeRem");
    const buttons = document.getElementById("buttons");
    const startButton = document.getElementById("start");
    const finishButton = document.getElementById("finish");
    const cancelButton = document.getElementById("cancel");
    if (request.captureStarted && request.captureStarted === tabs[0].id) {
      chrome.storage.sync.get(
        {
          maxTime: 1200000,
          limitRemoved: false,
        },
        (options) => {
          if (options.maxTime > 1200000) {
            chrome.storage.sync.set({
              maxTime: 1200000,
            });
            timeLeft = 1200000 - (Date.now() - request.startTime);
          } else {
            timeLeft = options.maxTime - (Date.now() - request.startTime);
          }
          status.innerHTML = "Tab is currently being captured";
          if (options.limitRemoved) {
            timeRem.innerHTML = `${parseTime(Date.now() - request.startTime)}`;
            interval = setInterval(() => {
              timeRem.innerHTML = `${parseTime(
                Date.now() - request.startTime
              )}`;
            }, 1000);
          } else {
            timeRem.innerHTML = `${parseTime(timeLeft)} remaining`;
            interval = setInterval(() => {
              timeLeft = timeLeft - 1000;
              timeRem.innerHTML = `${parseTime(timeLeft)} remaining`;
            }, 1000);
          }
        }
      );
      finishButton.style.display = "block";
      cancelButton.style.display = "block";
      startButton.style.display = "none";
    } else if (
      request.captureStopped &&
      request.captureStopped === tabs[0].id
    ) {
      status.innerHTML = "";
      finishButton.style.display = "none";
      cancelButton.style.display = "none";
      startButton.style.display = "block";
      timeRem.innerHTML = "";
      clearInterval(interval);
    }
  });
});

//initial display for popup menu when opened
document.addEventListener("DOMContentLoaded", function () {
  displayStatus();
  const startKey = document.getElementById("startKey");
  const endKey = document.getElementById("endKey");
  const startButton = document.getElementById("start");
  const finishButton = document.getElementById("finish");
  const cancelButton = document.getElementById("cancel");
  startButton.onclick = () => {
    chrome.runtime.sendMessage("startCapture");
  };
  finishButton.onclick = () => {
    chrome.runtime.sendMessage("stopCapture");
  };
  cancelButton.onclick = () => {
    chrome.runtime.sendMessage("cancelCapture");
  };
});

// listener from complete.js pipeline
document.addEventListener("DOMContentLoaded", function (event) {
  const encodeProgress = document.getElementById("encodeProgress");
  const saveButton = document.getElementById("saveCapture");
  const closeButton = document.getElementById("close");
  const review = document.getElementById("review");
  const status = document.getElementById("status2");
  const doctorSpeak = document.getElementById("doctorSpeak");
  const transcriptionResult = document.getElementById("transcriptionResult");
  const OPENAI_API_KEY = "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";
  let format;
  let audioURL;
  let encoding = false;
  async function getTranscription(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", "whisper-1");

    try {
      const response = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: formData,
        }
      );

      const data = await response.json();
      const transcription = data.text;
      transcriptionResult.innerHTML = `Transcription: ${transcription}`;
      return transcription;
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
        messages: [{ role: "user", content: `${prompt}` }],
        model: "gpt-4-0314",
        temperature: 0,
        max_tokens: 200,
      }),
    });
    const data = await response.json();
    const medicalDocumentation = data.choices[0].message.content.trim();
    doctorSpeak.innerHTML = `Doctor Speak: ${medicalDocumentation}`;
    return medicalDocumentation;
  }

  async function getFileFromURL(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    const currentDate = new Date(Date.now()).toDateString();
    const file = new File([blob], `${currentDate}.${format}`, {
      type: blob.type,
    });
    return file
  }

  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.type === "captureComplete") {
      format = request.format;
      let startID = request.startID;
      status2.innerHTML = "Please wait...";
      closeButton.onclick = () => {
        chrome.runtime.sendMessage({ cancelEncodeID: startID });
        encoding = true;
      };

      //if the encoding completed before the page has loaded
      if (request.audioURL) {
        console.log("audioURL", "audioURL REC.");
        encodeProgress.style.width = "100%";
        status2.innerHTML = "File is ready!";
        generateSave(request.audioURL);

        // Call the getTranscription and getDoctorSpeak functions
        // Problem here is request.audioURL is not a file. Need to pass in an .mp3
        getTranscription(request.audioURL).then((transcription) => {
          getDoctorSpeak(transcription);
          console.log("functions", "functions success");
        });
      } else {
        encoding = true;
      }
    }

    //when encoding completes
    if (request.type === "encodingComplete") {
      console.log("encodingComplete", "ENCODING COMPLETE RECEIVED");
      encoding = false;
      const file = await getFileFromURL(request.audioURL)
      status2.innerHTML = "File is ready!";
      encodeProgress.style.width = "100%";
      generateSave(request.audioURL);
      // Call the getTranscription and getDoctorSpeak functions
      getTranscription(file).then((transcription) => {
        getDoctorSpeak(transcription);
        console.log("transcription and notes", "generated");
      });
    }
    //updates encoding process bar upon messages
    if (request.type === "encodingProgress" && encoding) {
      encodeProgress.style.width = `${request.progress * 100}%`;
    }

    function generateSave(url) {
      //creates the save button
      const currentDate = new Date(Date.now()).toDateString();
      saveButton.onclick = () => {
        chrome.downloads.download({
          url: url,
          filename: `${currentDate}.${format}`,
          saveAs: true,
        });
      };
      saveButton.style.display = "inline-block";
      saveButton.onclick = async () => {
        // Convert the audioURL to a File object
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `${currentDate}.${format}`, {
          type: blob.type,
        });

        // Download the file
        chrome.downloads.download({
          url: url,
          filename: `${currentDate}.${format}`,
          saveAs: true,
        });
      };
    }
  });
});
