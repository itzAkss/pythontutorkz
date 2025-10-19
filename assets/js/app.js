
// Helper to run code in Skulpt and capture output
function outf(text) {
    let out = document.getElementById("output");
    out.textContent += text;
}
function builtinRead(x) {
    if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined)
        throw "File not found: '" + x + "'";
    return Sk.builtinFiles["files"][x];
}

// Run full program
async function runFullCode(code) {
    document.getElementById("output").textContent = "";
    Sk.configure({ output:outf, read:builtinRead });
    try {
        await Sk.misceval.asyncToPromise(function() {
            return Sk.importMainWithBody("<stdin>", false, code, true);
        });
    } catch (e) {
        document.getElementById("output").textContent += "\n[Қате] " + e.toString();
    }
}

// For stepping: we simulate by executing prefixes of the code incrementally.
// We also append a small snippet that prints variables in a sentinel format.
function makeSnapshotCode(prefix) {
    // We append safe inspector to show variable summary
    const inspector = '\n__PTVARS = {k:v for k,v in globals().items() if not k.startswith("__")}\nprint("::VARS::" + str(__PTVARS))';
    return prefix + "\n" + inspector;
}

async function runPrefixAndParse(codePrefix) {
    let outEl = document.getElementById("output");
    outEl.textContent = "";
    Sk.configure({ output:outf, read:builtinRead });
    let snapshotCode = makeSnapshotCode(codePrefix);
    try {
        await Sk.misceval.asyncToPromise(function() {
            return Sk.importMainWithBody("<stdin>", false, snapshotCode, true);
        });
    } catch (e) {
        // Show error but keep output
        outEl.textContent += "\n[Қате] " + e.toString();
    }
    // After run, parse output to find last ::VARS:: occurrence
    const txt = outEl.textContent;
    const idx = txt.lastIndexOf("::VARS::");
    let vars = {};
    if (idx !== -1) {
        // The representation is Python-like; try to eval safely by extracting substring
        const blob = txt.substring(idx + "::VARS::".length).trim();
        // We will attempt a naive parsing: replace Python True/False/None with JS equivalents and use JSON-like transform
        let j = blob.replace(/True/g, "true").replace(/False/g, "false").replace(/None/g, "null");
        // Replace single quotes with double quotes carefully
        j = j.replace(/(['"])?([a-zA-Z_][a-zA-Z0-9_]*)\1\s*:/g, function(m,name){ return '"' + name + '":'; });
        j = j.replace(/'/g, '"');
        try {
            vars = JSON.parse(j);
        } catch (e) {
            // fallback: show raw string
            vars = {"_raw": blob};
        }
    }
    return vars;
}

document.addEventListener("DOMContentLoaded", function(){
    const codeEl = document.getElementById("code");
    const runFull = document.getElementById("runFull");
    const stepBtn = document.getElementById("stepBtn");
    const resetBtn = document.getElementById("resetBtn");
    const stepRange = document.getElementById("stepRange");
    const currentLine = document.getElementById("currentLine");
    const varsBody = document.getElementById("varsBody");

    // If opened from a lesson, prefill
    const lessoncode = localStorage.getItem("lesson_code");
    if (lessoncode) {
        codeEl.value = lessoncode;
        localStorage.removeItem("lesson_code");
    }

    runFull.addEventListener("click", async ()=>{
        await runFullCode(codeEl.value);
    });

    resetBtn.addEventListener("click", ()=>{
        document.getElementById("output").textContent = "";
        currentLine.textContent = "";
        varsBody.innerHTML = "";
    });

    stepBtn.addEventListener("click", async ()=>{
        const lines = codeEl.value.split("\n");
        stepRange.max = Math.max(1, lines.length);
        // Start stepping from 1 to n
        for (let i=1;i<=lines.length;i++) {
            stepRange.value = i;
            const prefix = lines.slice(0,i).join("\n");
            currentLine.textContent = lines[i-1];
            const vars = await runPrefixAndParse(prefix);
            // Render vars
            varsBody.innerHTML = "";
            if (Object.keys(vars).length===0) {
                const tr = document.createElement("tr");
                tr.innerHTML = "<td colspan='2'><em>Айнымалы жоқ немесе олардың мәндерін оқу мүмкін емес.</em></td>";
                varsBody.appendChild(tr);
            } else {
                for (const k in vars) {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `<td>${k}</td><td>${String(vars[k])}</td>`;
                    varsBody.appendChild(tr);
                }
            }
            // Small pause to allow user to observe
            await new Promise(r=>setTimeout(r, 550));
        }
    });

    // If user moves the range, run that prefix
    stepRange.addEventListener("input", async (e)=>{
        const idx = parseInt(e.target.value,10);
        const lines = codeEl.value.split("\n");
        const prefix = lines.slice(0,idx).join("\n");
        currentLine.textContent = lines[idx-1] || "";
        const vars = await runPrefixAndParse(prefix);
        varsBody.innerHTML = "";
        if (Object.keys(vars).length===0) {
            const tr = document.createElement("tr");
            tr.innerHTML = "<td colspan='2'><em>Айнымалы жоқ немесе олардың мәндерін оқу мүмкін емес.</em></td>";
            varsBody.appendChild(tr);
        } else {
            for (const k in vars) {
                const tr = document.createElement("tr");
                tr.innerHTML = `<td>${k}</td><td>${String(vars[k])}</td>`;
                varsBody.appendChild(tr);
            }
        }
    });
});
