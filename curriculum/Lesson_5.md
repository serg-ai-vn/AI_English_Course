**Lesson Spec Sheet: Lesson 5**  
*v2 — актуализирована 06.08.2026 под реализацию платформы: аудит = чек-лист из 2 подтверждений в воркспейсе; рефлексия = 6 отдельных полей (по ≥15 слов); публикация/экспорт — действие учителя в консоли (ученик завершает L5 и просит учителя опубликовать). Устная защита (60 мин) — офлайн в классе.*

**1. Lesson Objective**
* **Content**: Students will perform a final audit of their website to remove personal data and AI hallucinations, publish/export the final product, and deliver a 3-5 minute public defense.
* **Language**: Students will use presentation skills to confidently explain their design choices, describe their prompt iterations (before and after), and answer spontaneous questions in English.
* **AI-literacy**: Students will apply the "Operator Rule" one last time to ensure no personal data leaks or AI-invented facts remain on their site, and reflect on their growth as AI co-creators.

**2. Target Vocabulary**
*(Note: kept to 10 words — students are primarily focused on the high cognitive demand of public speaking, presenting, and answering spontaneous questions.)*
1. Publish
2. Audit
3. Operator
4. Data
5. Fact
6. Prompt
7. Export
8. Link
9. Change
10. Presentation

**3. Grammar Focus**
Not specified for this lesson (не задан для этого занятия).

**4. Timing (90 minutes total)**
* **00:00 – 00:10 (10 min)**: Introduction, reading the Driving Question aloud, and the Final Operator Audit.
* **00:10 – 00:25 (15 min)**: Website Publishing / Exporting and Final Prompt Journal Reflection.
* **00:25 – 01:25 (60 min)**: Public Defense Presentations (Open Discussion & Q&A).
* **01:25 – 01:30 (5 min)**: Wrap-up and Handover to Parents.

**5. Scenario**

**Intro, Driving Question & Audit (10 min) – Scripted:**
**Teacher**: "Welcome to our final lesson! Today is the day you show your work to the world. But first, let's remember our main goal for this entire course. Listen carefully: **How can I critically partner with Artificial Intelligence to build a digital portfolio that authentically represents who I am to the world?**"

**Teacher**: "Before we **publish** your site, we must do a final **audit**. You must act as the **operator**. Check your site right now. Did you leave any real personal **data**? Did the AI invent a false **fact** about you? Fix it now."

**Teacher**: "As a quick reminder, a **prompt** is a set of clear instructions you write to tell the AI exactly what to make or write for you."

**Publishing, Exporting & Reflection (15 min) – Scripted:**
**Teacher**: "Now that your **audit** is complete, it is time to **export** your website. We will create a real **link** for you to share with your family and friends."

**Teacher**: "Open your journals for the last time. Answer these questions before we present:"

1. What was the most surprising thing AI did during this course?
2. Show one "before" and "after" from your journal. What did you change, and why?
3. What English words or phrases do you feel more confident using now than at the start of the course?
4. What was the hardest part of being "the Operator"?
5. If you made this website again, what would you do differently?
6. What is one thing you want to try with AI outside of class?

*Example 1 (Teacher modeling)*: "I am checking my text... No real address, good. Now I click **export** to get my **link**."
*Example 2 (Teacher modeling)*: "I am writing my reflection... I learned how to **change** a bad AI text into my own words."
*Example 3 (Teacher modeling)*: "I have chosen my best 'before and after' example from question 2. Now my **presentation** is ready."

**Public Defense Presentations (60 min) – Open Discussion:**
**Teacher**: "It is time for your **presentation**. Show us your website, tell us how you made it, and show us one example of how you had to **change** an AI text or picture."

*Question Bank (spontaneous, from teacher/peers)*: "Why did you choose this visual style for your avatar?", "Why did you choose this theme and these colors for your site?", "What was the biggest mistake the AI made in your first draft?", "How did you fix the hallucination on your 'About Me' page?", "What does this specific English word on your website mean?"
*Expected Child Answers*: "I chose this style because I love concept art and lighting", "The AI wrote that I have three brothers, but I only have one, so I changed the prompt", "I added a rule to my system prompt to stop the chatbot from answering math questions", "This word means 'energetic' because I like playing active sports."

**Wrap-up (5 min) – Scripted:**
**Teacher**: "You all did an amazing job today. You are no longer just users; you are operators!"

**6. Prompt Journal**
* **Format**: Digital table integrated into the platform.
* **Action**: The student confirms the audit checklist (2 items: no real personal data / no AI-invented facts) and answers the six reflection questions below as their final self-assessment, at least 15 words each. The teacher's publish button also requires at least one of today's words (publish / export / change / presentation) somewhere across the six answers.

**7. Gating Rules (Platform Logic Table)**

| Rule / Condition | Action if Failed (System Prompt/Hint) |
|---|---|
| **Audit Confirmation** — both checklist items checked | "Please confirm you have audited your site to remove all real personal data and AI hallucinations." |
| **Reflection Length Check** — each answer ≥15 words | "Your answer is too short. Add one more sentence - at least 15 words in English." |
| **Final Reflection Check** — all six answers saved before export | "The student must complete the final audit and all six reflection questions before the site can be published." |
| **Target Vocabulary Check (Journal, cumulative)** — ≥1 of publish/export/change/presentation across all six answers | "Use one of today's words in your reflection: publish, export, change, or presentation." (мягкое предупреждение в UI ученика; жёсткий блок у учителя при публикации) |
| **Publish Gate** — export is a teacher-only action, requires L2-L5 complete | (hint in the teacher console) |

*Export note: `Build site` (preview) remains available to the teacher from L3; the final `Publish` (`/api/teacher/export-site`) is the Lesson 5 handover — it re-runs the export, stamps `published` and gives the family a link + downloadable single-file HTML.*

**8. Materials / Assets**
* Access to the student digital workspace for the final audit + reflection.
* Teacher console: monitor reflections, then publish (link + downloadable file).
* Projector/screen for students to display their websites during the Public Defense.
* Analytical rubric for the Public Defense (Prompt Engineering, Language Application, Final Website, Public Defense — see course guide).
* The reflection questions are already written into the script above — nothing further to prepare.
* **Photo Protocol**: During the course, no real photos of children's faces were uploaded — only AI-generated stylized avatars. Publishing at the end of this lesson is literally the export/handover step. The full export (files or a link to a personal hosting site) is transferred to the family. Once handed over, the family takes full responsibility and decides whether to add real names or photos. The school's AI-facing system retains only pseudonyms and the digital mask.
