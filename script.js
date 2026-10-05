const fileInput = document.getElementById("file-input");
const uploadButton = document.getElementById("upload-button");
const dropArea = document.getElementById("drop-area");

const fileCount = document.getElementById("file-count");
const previewContainer = document.getElementById("preview-container");

const analyzeButton = document.getElementById("analyze-button");

const results = document.getElementById("results");
const colorResults = document.getElementById("color-results");


let selectedFiles = [];


// --------------------------------------------------
// UPLOAD
// --------------------------------------------------

uploadButton.addEventListener("click", () => {
    fileInput.click();
});


fileInput.addEventListener("change", () => {

    selectedFiles = Array.from(fileInput.files);

    processFiles();

});


// Drag and drop

dropArea.addEventListener("dragover", (event) => {

    event.preventDefault();

    dropArea.classList.add("dragging");

});


dropArea.addEventListener("dragleave", () => {

    dropArea.classList.remove("dragging");

});


dropArea.addEventListener("drop", (event) => {

    event.preventDefault();

    dropArea.classList.remove("dragging");

    selectedFiles = Array.from(event.dataTransfer.files);

    processFiles();

});


// --------------------------------------------------
// PROCESS UPLOADED FILES
// --------------------------------------------------

function processFiles() {

    // Only allow images

    selectedFiles = selectedFiles.filter(file =>
        file.type.startsWith("image/")
    );


    // Maximum 10 photos

    if (selectedFiles.length > 10) {

        selectedFiles = selectedFiles.slice(0, 10);

        alert("Only the first 10 photos will be used.");

    }


    // Update text

    fileCount.textContent =
        `${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} selected`;


    // Clear previous previews

    previewContainer.innerHTML = "";


    // Create previews

    selectedFiles.forEach(file => {

        const image = document.createElement("img");

        image.src = URL.createObjectURL(file);

        previewContainer.appendChild(image);

    });


    // Enable analyze button

    analyzeButton.disabled = selectedFiles.length === 0;

}


// --------------------------------------------------
// ANALYZE COLORS
// --------------------------------------------------

analyzeButton.addEventListener("click", async () => {

    analyzeButton.disabled = true;

    analyzeButton.textContent = "Analyzing...";


    // Collect pixels from all photos

    const pixels = [];


    for (const file of selectedFiles) {

        const imagePixels = await getPixels(file);

        pixels.push(...imagePixels);

    }


    console.log("Total pixels:", pixels.length);


    // Run K-means clustering

    const clusters = kMeans(pixels, 5);


    // Display results

    displayColors(clusters);


    analyzeButton.disabled = false;

    analyzeButton.textContent = "Analyze Colors";

});


// --------------------------------------------------
// GET PIXELS FROM IMAGE
// --------------------------------------------------

function getPixels(file) {

    return new Promise((resolve, reject) => {

        const image = new Image();

        image.onload = () => {

            const canvas = document.createElement("canvas");

            const context = canvas.getContext("2d");


            // Resize image to make processing faster

            const maxSize = 100;

            const scale = Math.min(
                1,
                maxSize / Math.max(
                    image.width,
                    image.height
                )
            );


            canvas.width = image.width * scale;
            canvas.height = image.height * scale;


            context.drawImage(
                image,
                0,
                0,
                canvas.width,
                canvas.height
            );


            const imageData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );


            const pixels = [];


            // RGBA values

            for (
                let i = 0;
                i < imageData.data.length;
                i += 4
            ) {

                const r = imageData.data[i];
                const g = imageData.data[i + 1];
                const b = imageData.data[i + 2];
                const a = imageData.data[i + 3];


                // Ignore transparent pixels

                if (a < 128) {
                    continue;
                }


                // Store RGB vector

                pixels.push([r, g, b]);

            }


            resolve(pixels);

        };


        image.onerror = reject;

        image.src = URL.createObjectURL(file);

    });

}


// --------------------------------------------------
// K-MEANS
// --------------------------------------------------

function kMeans(points, k) {

    /*
        Each pixel is a vector:

        [R, G, B]

        Example:

        [255, 0, 0]

        = red
    */


    // Pick random starting centers

    let centers = [];


    for (let i = 0; i < k; i++) {

        const randomIndex =
            Math.floor(Math.random() * points.length);

        centers.push(
            [...points[randomIndex]]
        );

    }


    let assignments = [];


    // Repeat the process

    for (let iteration = 0; iteration < 15; iteration++) {


        // ------------------------------------------
        // STEP 1
        // Assign every pixel to nearest center
        // ------------------------------------------

        assignments = [];


        for (const point of points) {

            let closestCenter = 0;

            let smallestDistance = Infinity;


            for (let i = 0; i < centers.length; i++) {

                const distance =
                    colorDistance(
                        point,
                        centers[i]
                    );


                if (distance < smallestDistance) {

                    smallestDistance = distance;

                    closestCenter = i;

                }

            }


            assignments.push(closestCenter);

        }


        // ------------------------------------------
        // STEP 2
        // Calculate new centers
        // ------------------------------------------

        const sums =
            Array.from(
                { length: k },
                () => [0, 0, 0, 0]
            );


        for (let i = 0; i < points.length; i++) {

            const cluster =
                assignments[i];

            const point =
                points[i];


            sums[cluster][0] += point[0];
            sums[cluster][1] += point[1];
            sums[cluster][2] += point[2];

            sums[cluster][3] += 1;

        }


        // Calculate average RGB

        for (let i = 0; i < k; i++) {

            if (sums[i][3] === 0) {
                continue;
            }


            centers[i] = [

                sums[i][0] / sums[i][3],

                sums[i][1] / sums[i][3],

                sums[i][2] / sums[i][3]

            ];

        }

    }


    // Count pixels in each cluster

    const counts =
        Array(k).fill(0);


    for (const assignment of assignments) {

        counts[assignment]++;

    }


    // Combine centers and counts

    const clusters =
        centers.map((center, index) => {

            return {

                color: center,

                count: counts[index]

            };

        });


    // Sort largest clusters first

    clusters.sort(
        (a, b) => b.count - a.count
    );


    return clusters;

}


// --------------------------------------------------
// COLOR DISTANCE
// --------------------------------------------------

function colorDistance(color1, color2) {

    const r =
        color1[0] - color2[0];

    const g =
        color1[1] - color2[1];

    const b =
        color1[2] - color2[2];


    return (
        r * r +
        g * g +
        b * b
    );

}


// --------------------------------------------------
// DISPLAY RESULTS
// --------------------------------------------------

function displayColors(clusters) {

    colorResults.innerHTML = "";


    const totalPixels =
        clusters.reduce(
            (sum, cluster) =>
                sum + cluster.count,
            0
        );


    clusters.forEach((cluster, index) => {

        const [r, g, b] =
            cluster.color.map(Math.round);


        const hex =
            rgbToHex(r, g, b);


        const percentage =
            (
                cluster.count /
                totalPixels *
                100
            ).toFixed(1);


        const card =
            document.createElement("div");


        card.className =
            "color-card";


        card.innerHTML = `

            <div
                class="color-swatch"
                style="
                    background-color: rgb(
                        ${r},
                        ${g},
                        ${b}
                    );
                "
            ></div>


            <div class="color-info">

                <div class="color-name">
                    #${index + 1}
                </div>

                <div class="color-value">
                    ${hex}
                </div>

                <div class="color-value">
                    RGB(${r}, ${g}, ${b})
                </div>

                <div class="color-percentage">
                    ${percentage}% of pixels
                </div>

            </div>

        `;


        colorResults.appendChild(card);

    });


    results.classList.remove("hidden");

}


// --------------------------------------------------
// RGB → HEX
// --------------------------------------------------

function rgbToHex(r, g, b) {

    return "#" +

        [r, g, b]

        .map(value =>
            value
                .toString(16)
                .padStart(2, "0")
        )

        .join("")

        .toUpperCase();

}