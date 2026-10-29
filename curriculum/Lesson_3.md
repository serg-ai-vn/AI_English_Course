**Lesson Spec Sheet: Lesson 3**

**1. Lesson Objective**
* **Content**: Students will generate and iteratively refine images for their websites using text-to-image AI tools, and practically identify factual errors and visual anomalies in AI outputs.
* **Language**: Students will acquire and apply specific vocabulary related to visual styles and lighting, and practice expressing reasons for rejecting or modifying AI outputs.
* **AI-literacy**: Students will understand the concept of AI "hallucinations" (confident fabrication of false facts) and visual deepfake flaws (struggles with small details), reinforcing the "Operator" mindset of critically verifying all AI content.

**2. Target Vocabulary**
*(Note: kept to 10 words for low cognitive load, since students are navigating a new interface — image generation — while practicing critical hallucination detection simultaneously.)*
1. Prompt
2. Avatar
3. Background
4. Generate
5. Concept art
6. Close-up
7. Volumetric lighting
8. Hallucination
9. Fact
10. Detail

**3. Grammar Focus**
Not specified for this lesson (не задан для этого занятия).

**4. Timing (90 minutes total)**
* **00:00 – 00:05 (5 min)**: Introduction and reading the Driving Question aloud.
* **00:05 – 00:30 (25 min)**: Visual Styles & Image Generation.
* **00:30 – 00:55 (25 min)**: The "Hallucination Hunt" Activity.
* **00:55 – 01:15 (20 min)**: Deepfakes and Visual Flaws.
* **01:15 – 01:30 (15 min)**: Prompt Journal completion and Wrap-up.

**5. Scenario**

**Intro & Driving Question (5 min) – Scripted:**
**Teacher**: "Welcome back! Today we focus on visuals and keeping a critical eye on the AI. Let's remember our main goal for the whole course. Listen carefully: **How can I critically partner with Artificial Intelligence to build a digital portfolio that authentically represents who I am to the world?**"

**Visual Styles & Image Generation (25 min) – Scripted:**
**Teacher**: "We need pictures for your website. But for safety, we will not use real photos of your faces. Instead, we will generate an **avatar** or a cool **background** picture. To do this, you need a **prompt**. A prompt is a set of clear instructions you write to tell the AI exactly what to make or write for you."

*(Teacher note, can mention briefly: today's background is a picture — like a photo behind your avatar. In Lesson 4, we'll also choose an overall theme with colors and fonts for the whole site. Two different things!)*

**Teacher**: "If you just say 'a boy', the image will be boring. We must use style words to **generate** something unique. You can ask for **concept art** if you want it to look like a video game. If you want the camera very near, ask for a **close-up**. For beautiful, realistic shadows, add the words **volumetric lighting**."

*Example 1*: "Generate a **close-up** of a 12-year-old boy playing chess, **concept art** style, **volumetric lighting**."
*Example 2*: "Generate a **background** with a futuristic city, **volumetric lighting**, no people."
*Example 3*: "Generate a **close-up** of a girl reading a book in a forest, **concept art**."

**The "Hallucination Hunt" (25 min) – Scripted intro, then Open Discussion:**
**Teacher**: "Let's test if the AI always tells the truth. Here's what happened when I asked the chatbot **before class** to describe our school basketball team's 2025 championship." *(Teacher projects the text below.)*

> "Our school's basketball team had an incredible 2025 season! Led by team captain John Miller, the Eagles finished the regular season with a 14-2 record. In the championship final, they defeated Lincoln Middle School 58-52, with John Miller scoring a career-high 24 points, including the game-winning three-pointer with just 8 seconds left on the clock. Coach Davies called it 'the greatest moment in school history.' The team celebrated with a parade through the school courtyard the following Monday."

**Teacher**: "Look! The AI wrote this with 100% confidence, but it is a complete lie! This is a **hallucination**! The AI can invent a false **fact**."

**Teacher**: "When something surprises us, good fact-checkers do three things: they **Stop**, they **Investigate** where the information came from, and they **Trace** the claim back to see if it's real. Let's do that right now with this text."

*Question Bank*: "Can you find three invented facts in this text?", "Why did the AI invent this story instead of saying 'I don't know'?", "How can we change the prompt to stop this hallucination?"
*Expected Child Answers*: "Our team didn't win in 2025, that is in the future!", "There is no player named John in our school!", "Maybe the AI just wants to make us happy and give us an answer."

*Teacher note (not read aloud): if your school has a real team or a real 2025 result, swap the name/score/year above so nothing accidentally matches something true — the fabrication needs to be unmistakable to your specific class.*

**Deepfakes and Visual Flaws (20 min) – Open Discussion:**
**Teacher**: "AI also makes hallucinations in pictures. Look at this generated character on the board." *(Teacher projects a pre-generated image with a visible flaw — see Materials below for how to prepare this.)*

*Question Bank*: "Look closely at the **detail** in this picture. What is wrong with the hands?", "Why do you think the AI struggles with small details like this?"
*Expected Child Answers*: "He has six fingers on one hand!", "The hand looks like it is melting.", "The AI doesn't know what a real hand is."

**Teacher**: "Look at the fingers of the generated character — AI struggles with small details. You must act as the Operator and check every **detail** before using it."

**Prompt Journal & Wrap-up (15 min) – Scripted:**
**Teacher**: "Now, open your platform and start generating your avatar and backgrounds. Write your prompt using our formula: **Subject**, **Style**, **Framing**, **Lighting**. After each image, write two short notes in English: what you like and what you don't like. Try at least 3 iterations — each time, change at least one part of the formula, so you can see how the AI reacts."

**Teacher**: "Before we finish — make sure you've picked your **best** image and your **worst** image, each with a short English reason. The best goes on your website; the worst stays in your journal as a record of what you learned to catch. Next time, we put everything together: your text and your pictures, into your actual website!"

**6. Prompt Journal**
* **Format**: Digital table integrated into the platform.
* **Prompt structure**: Every prompt must follow the four-part formula — `Subject: ...  Style: ...  Framing: ...  Lighting: ...`. This is what the platform parses and compares across iterations.
* **Per-iteration log (mandatory on every iteration)**: the prompt itself plus two short English notes from the student:
  * **pros** — what the student likes about this image (≥3 words);
  * **cons** — what the student does not like or wants to improve (≥3 words). Hallucinations, visual flaws, off-goal framing belong here.
* **Iteration rule**: each new iteration must differ from the previous one in at least one of the four formula fields (`Subject` / `Style` / `Framing` / `Lighting`). Changing all four is allowed; changing none is not — the student must keep one variable under control to see how the AI reacts to it.
* **Minimum**: 3 rated iterations per image field (avatar, background). The student may keep generating (up to a cap) until they are ready to choose.
* **Final pick**: after the iterations, the student selects one **best** image (→ goes on the website) and one **worst** image (stays in the journal), each with an English reason. The third (and any extra) iterations remain in the journal as a record without a best/worst mark.

**7. Gating Rules (Platform Logic Table)**

| Rule / Condition | Action if Failed (System Prompt/Hint) |
|---|---|
| **Prompt Structure Check** — every prompt must contain all four labels `Subject:`, `Style:`, `Framing:`, `Lighting:` | "Use the formula: Subject:, Style:, Framing:, Lighting:." |
| **Structure Change Check** — the current prompt must differ from the previous one in at least one of the four fields | "Change at least one of Subject / Style / Framing / Lighting from your last prompt." |
| **Target Vocabulary Check** — at least 1 of today's visual words appears in the prompt | "Try using one of today's visual words: concept art, close-up, or volumetric lighting." |
| **Pros Check** — `pros` field has ≥3 words on every iteration | "Tell what you like about this image (at least 3 words)." |
| **Cons Check** — `cons` field has ≥3 words on every iteration | "Tell what you don't like or what could be improved (at least 3 words)." |
| **Minimum Image Iterations** — ≥3 rated iterations (i.e. 3 iterations with pros+cons that passed the structure + change checks) | "You need at least 3 iterations for your image. Try changing the lighting or style." |
| **Best Pick Check** — exactly one iteration marked `best` with a non-empty reason | "Pick your best image and say why it is your best." |
| **Worst Pick Check** — exactly one iteration marked `worst` with a non-empty reason, and `worst ≠ best` | "Pick your worst image and say why it is your worst." |

**8. Materials / Assets**
* Access to the student digital workspace (platform wrapper over LLM and Text-to-Image API).
* Teacher console to monitor prompts and image generations.
* The Hallucination Hunt text is already written into the script above — nothing further to prepare for that part.
* **Deepfake image — prepare this yourself before class**: generate 2-3 images through your own image API in advance (hands on a close-up shot are one of the most reliable ways to catch a visible flaw — try prompts like *"two people shaking hands, photorealistic, close-up"* or *"a person holding a pen, detailed hands"*). Save the most obviously flawed result as your projector image.
* **Photo Protocol**: Strict prohibition on uploading real photos of students' faces into the image generator. All visual representations of students must be stylized avatars generated entirely via text descriptions (prompts) using their digital mask.
