export async function onRequestPost({ request, env }) {
  if (!env.AI) return Response.json({ error: "Workers AI не подключён. Добавьте binding AI в Cloudflare Pages." }, { status: 503 });
  let input;
  try { input = await request.json(); } catch { return Response.json({ error: "Некорректный запрос." }, { status: 400 }); }
  const topic = String(input.topic || "").trim().slice(0, 2000);
  const count = Math.min(15, Math.max(3, Number(input.count) || 8));
  if (!topic) return Response.json({ error: "Введите тему презентации." }, { status: 400 });
  const prompt = `Ты профессиональный автор презентаций и дизайнер структуры слайдов. Создай содержательную, логичную презентацию на русском/указанном языке.
ТЕМА: ${topic}
АУДИТОРИЯ: ${input.audience || "Общая"}
ЯЗЫК: ${input.language || "Русский"}
СТИЛЬ: ${input.style || "editorial"}
ПОЖЕЛАНИЯ: ${String(input.notes || "").slice(0,1000)}
КОЛИЧЕСТВО СЛАЙДОВ: ровно ${count}.
Верни ТОЛЬКО валидный JSON без markdown и пояснений в формате:
{"slides":[{"title":"Короткий заголовок","eyebrow":"КАТЕГОРИЯ","body":"2–4 коротких содержательных тезиса, каждый с новой строки","layout":"title|content|split|stats|quote|conclusion"}]}
Правила: первый слайд — сильный титульный с подзаголовком; последний — выводы/итоги. Каждый слайд раскрывает отдельную мысль. Не выдумывай конкретные научные результаты, цифры, цитаты и источники. Если тема научная, отделяй общепринятые сведения от предположений и укажи, где нужны данные пользователя. Избегай длинных абзацев; делай краткие тезисы. Не повторяй одинаковые фразы.`;
  try {
    const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: "Ты создаёшь профессиональные презентации. Возвращай только корректный JSON." },
        { role: "user", content: prompt }
      ],
      max_tokens: 3500,
      temperature: 0.55
    });
    let raw = result.response || result.output || "";
    raw = String(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.slides)) throw new Error("Invalid slides");
    return Response.json({ slides: parsed.slides.slice(0, count) });
  } catch (e) {
    return Response.json({ error: "ИИ не смог сформировать корректный ответ. Попробуйте ещё раз или сократите тему." }, { status: 502 });
  }
}
