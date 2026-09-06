use enigo::{Enigo, Key, KeyboardControllable, MouseControllable};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Emitter, Manager, PhysicalPosition};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

#[derive(Serialize, Deserialize)]
struct AIRequest {
    text: String,
    prompt: String,
    api_key: String,
    #[serde(default)]
    system_prompt: Option<String>,
    #[serde(default)]
    provider: Option<String>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    base_url: Option<String>,
}

struct ShortcutCaptureState {
    in_progress: AtomicBool,
    cancelled: AtomicBool,
    source_window: Mutex<Option<String>>,
}

impl Default for ShortcutCaptureState {
    fn default() -> Self {
        Self {
            in_progress: AtomicBool::new(false),
            cancelled: AtomicBool::new(false),
            source_window: Mutex::new(None),
        }
    }
}

struct ShortcutCaptureGuard<'a>(&'a AtomicBool);

impl Drop for ShortcutCaptureGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[tauri::command]
async fn process_text(request: AIRequest) -> Result<String, String> {
    let client = reqwest::Client::new();
    let provider = request
        .provider
        .as_deref()
        .unwrap_or("openai")
        .to_lowercase();
    let model = request
        .model
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("gpt-4.1-mini");
    let system_prompt = format!(
        "{}\n\nCRITICAL RULE: Return pure text ONLY. No markdown formatting, no backticks, no asterisks, no hashes, no bullet points, and no symbols. Do NOT wrap the output in code blocks.",
        request.system_prompt.unwrap_or_else(|| "You are a helpful writing assistant. Follow the user's instructions exactly. Only return the modified text, no explanations.".to_string())
    );
    let user_prompt = format!("{}: \n\n{}", request.prompt, request.text);

    match provider.as_str() {
        "anthropic" => {
            let response = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &request.api_key)
                .header("anthropic-version", "2023-06-01")
                .header("Content-Type", "application/json")
                .json(&serde_json::json!({
                    "model": model,
                    "max_tokens": 4096,
                    "temperature": 0.2,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}]
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let status = response.status();
            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;
            if !status.is_success() || json.get("error").is_some() {
                return Err(format_provider_error("Anthropic", &json, status));
            }
            json["content"][0]["text"]
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| format!("Failed to parse Anthropic response. Full response: {}", json))
        }
        "google" => {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model,
                request.api_key
            );
            let response = client
                .post(url)
                .header("Content-Type", "application/json")
                .json(&serde_json::json!({
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                    "generationConfig": {"temperature": 0.2}
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let status = response.status();
            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Google response: {}", e))?;
            if !status.is_success() || json.get("error").is_some() {
                return Err(format_provider_error("Google", &json, status));
            }
            json["candidates"][0]["content"]["parts"][0]["text"]
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| format!("Failed to parse Google response. Full response: {}", json))
        }
        _ => {
            let endpoint = chat_completions_endpoint(&provider, request.base_url.as_deref())?;
            let mut builder = client
                .post(endpoint)
                .header("Content-Type", "application/json")
                .json(&serde_json::json!({
                    "model": model,
                    "temperature": 0.2,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ]
                }));
            if !request.api_key.trim().is_empty() {
                builder = builder.header("Authorization", format!("Bearer {}", request.api_key));
            }
            if provider == "openrouter" {
                builder = builder.header("X-Title", "Ghost Writer");
            }
            let response = builder.send().await.map_err(|e| e.to_string())?;
            let status = response.status();
            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse provider response: {}", e))?;
            if !status.is_success() || json.get("error").is_some() {
                return Err(format_provider_error(&provider, &json, status));
            }
            json["choices"][0]["message"]["content"]
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| format!("Failed to parse provider response. Full response: {}", json))
        }
    }
}

fn chat_completions_endpoint(provider: &str, base_url: Option<&str>) -> Result<String, String> {
    if matches!(provider, "openai-compatible" | "lmstudio" | "mlx" | "ollama") {
        let base = base_url
            .unwrap_or_default()
            .trim()
            .trim_end_matches('/');
        if base.is_empty() {
            return Err(format!("{} requires a base URL.", provider));
        }
        return Ok(if base.ends_with("/chat/completions") {
            base.to_string()
        } else {
            format!("{}/chat/completions", base)
        });
    }

    let endpoint = match provider {
        "openai" => "https://api.openai.com/v1/chat/completions",
        "xai" => "https://api.x.ai/v1/chat/completions",
        "cerebras" => "https://api.cerebras.ai/v1/chat/completions",
        "groq" => "https://api.groq.com/openai/v1/chat/completions",
        "deepseek" => "https://api.deepseek.com/chat/completions",
        "mistral" => "https://api.mistral.ai/v1/chat/completions",
        "openrouter" => "https://openrouter.ai/api/v1/chat/completions",
        other => return Err(format!("Unsupported AI provider: {}", other)),
    };
    Ok(endpoint.to_string())
}

fn format_provider_error(provider: &str, json: &serde_json::Value, status: reqwest::StatusCode) -> String {
    let message = json["error"]["message"]
        .as_str()
        .or_else(|| json["message"].as_str())
        .unwrap_or("Unknown provider error");
    format!("{} API Error ({}): {}", provider, status, message)
}

#[tauri::command]
async fn lm_ping(base_url: String) -> Result<u16, String> {
    let base = base_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Base URL is empty".to_string());
    }
    let endpoint = if base.ends_with("/models") {
        base.to_string()
    } else {
        format!("{}/models", base)
    };
    let response = reqwest::Client::new()
        .get(endpoint)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.status().as_u16())
}

// ── Image Generation ──────────────────────────────────────────────────────────

#[tauri::command]
async fn generate_image(
    prompt: String,
    api_key: String,
    model: Option<String>,
    provider: Option<String>,
    base_url: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let selected_model = model
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "gpt-image-2".to_string());
    let selected_provider = provider
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "openai".to_string())
        .to_lowercase();

    match selected_provider.as_str() {
        "google" => generate_google_image(&client, &api_key, &selected_model, &prompt).await,
        "openrouter" => {
            generate_openrouter_image(&client, &api_key, &selected_model, &prompt).await
        }
        _ => {
            generate_openai_style_image(
                &client,
                &selected_provider,
                base_url.as_deref(),
                &api_key,
                &selected_model,
                &prompt,
            )
            .await
        }
    }
}

async fn generate_openai_style_image(
    client: &reqwest::Client,
    provider: &str,
    base_url: Option<&str>,
    api_key: &str,
    model: &str,
    prompt: &str,
) -> Result<String, String> {
    let endpoint = match provider {
        "openai" => "https://api.openai.com/v1/images/generations".to_string(),
        "xai" => "https://api.x.ai/v1/images/generations".to_string(),
        "openai-compatible" => {
            let base = base_url
                .unwrap_or_default()
                .trim()
                .trim_end_matches('/');
            if base.is_empty() {
                return Err("Custom image endpoint requires a base URL.".to_string());
            }
            if base.ends_with("/images/generations") {
                base.to_string()
            } else {
                format!("{}/images/generations", base)
            }
        }
        other => return Err(format!("{} does not provide a supported image API.", other)),
    };

    let mut payload = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024"
    });
    if provider != "xai" {
        payload["response_format"] = serde_json::json!("b64_json");
    }

    let mut request = client
        .post(endpoint)
        .header("Content-Type", "application/json")
        .json(&payload);
    if !api_key.trim().is_empty() {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }
    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status();
    let mut json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse {} image response: {}", provider, e))?;

    if (!status.is_success() || json.get("error").is_some())
        && provider == "openai"
        && model == "gpt-image-2"
    {
        let message = json["error"]["message"].as_str().unwrap_or("");
        if message.contains("gpt-image-2")
            && (message.contains("does not exist")
                || message.contains("not found")
                || message.contains("permission"))
        {
            let retry_response = client
                .post("https://api.openai.com/v1/images/generations")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .json(&serde_json::json!({
                    "model": "gpt-image-1",
                    "prompt": prompt,
                    "n": 1,
                    "size": "1024x1024",
                    "response_format": "b64_json"
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            json = retry_response
                .json()
                .await
                .map_err(|e| format!("Failed to parse fallback image response: {}", e))?;
        }
    }

    extract_image_from_response(client, provider, &json).await
}

async fn generate_openrouter_image(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    prompt: &str,
) -> Result<String, String> {
    let response = client
        .post("https://openrouter.ai/api/v1/images")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("X-Title", "Ghost Writer")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": model,
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024"
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = response.status();
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenRouter image response: {}", e))?;
    if !status.is_success() || json.get("error").is_some() {
        return Err(format_provider_error("OpenRouter", &json, status));
    }
    extract_image_from_response(client, "OpenRouter", &json).await
}

async fn generate_google_image(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    prompt: &str,
) -> Result<String, String> {
    // Current Gemini image models use the Interactions API. Keep the older
    // generateContent path below for the preview model that is still exposed
    // in the picker for existing API keys.
    if model.ends_with("-image") {
        let response = client
            .post("https://generativelanguage.googleapis.com/v1beta/interactions")
            .header("x-goog-api-key", api_key)
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "model": model,
                "input": [{"type": "text", "text": prompt}],
                "response_format": {"type": "image", "mime_type": "image/png"}
            }))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = response.status();
        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Google image response: {}", e))?;
        if !status.is_success() || json.get("error").is_some() {
            return Err(format_provider_error("Google", &json, status));
        }
        if let Some((data, mime_type)) = find_inline_image_data(&json) {
            return Ok(image_data_url(&data, mime_type.as_deref()));
        }
        return Err(format!("Google returned no image data: {}", json));
    }

    let endpoint = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );
    let response = client
        .post(endpoint)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = response.status();
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Google image response: {}", e))?;
    if !status.is_success() || json.get("error").is_some() {
        return Err(format_provider_error("Google", &json, status));
    }

    let parts = json["candidates"][0]["content"]["parts"]
        .as_array()
        .ok_or_else(|| format!("Unexpected Google image response: {}", json))?;
    for part in parts {
        for key in ["inlineData", "inline_data"] {
            if let Some(data) = part[key]["data"].as_str() {
                let mime_type = part[key]["mimeType"]
                    .as_str()
                    .or_else(|| part[key]["mime_type"].as_str());
                return Ok(image_data_url(data, mime_type));
            }
        }
    }
    Err(format!("Google returned no image data: {}", json))
}

fn find_inline_image_data(value: &serde_json::Value) -> Option<(String, Option<String>)> {
    match value {
        serde_json::Value::Object(object) => {
            if object.get("type").and_then(|value| value.as_str()) == Some("image") {
                if let Some(data) = object.get("data").and_then(|value| value.as_str()) {
                    let mime_type = object
                        .get("mime_type")
                        .or_else(|| object.get("mimeType"))
                        .and_then(|value| value.as_str())
                        .map(str::to_owned);
                    return Some((data.to_string(), mime_type));
                }
            }
            object.values().find_map(find_inline_image_data)
        }
        serde_json::Value::Array(values) => values.iter().find_map(find_inline_image_data),
        _ => None,
    }
}

fn image_data_url(base64: &str, mime_type: Option<&str>) -> String {
    format!(
        "data:{};base64,{}",
        mime_type.unwrap_or("image/png"),
        base64
    )
}

async fn extract_image_from_response(
    client: &reqwest::Client,
    provider: &str,
    json: &serde_json::Value,
) -> Result<String, String> {
    if let Some(error) = json.get("error") {
        let message = error["message"].as_str().unwrap_or("Unknown image error");
        return Err(format!("{} Image API Error: {}", provider, message));
    }
    let image = &json["data"][0];
    if let Some(b64) = image["b64_json"].as_str() {
        let mime_type = image["media_type"]
            .as_str()
            .or_else(|| image["mime_type"].as_str())
            .or_else(|| image["mimeType"].as_str());
        return Ok(image_data_url(b64, mime_type));
    }
    if let Some(data_url) = image["url"].as_str() {
        if data_url.starts_with("data:image/") && data_url.contains(',') {
            return Ok(data_url.to_string());
        }
        let img_response = client
            .get(data_url)
            .send()
            .await
            .map_err(|e| format!("Failed to download generated image: {}", e))?;
        let mime_type = img_response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .map(|value| value.split(';').next().unwrap_or(value).to_string());
        let img_bytes = img_response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read image bytes: {}", e))?;
        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD.encode(&img_bytes);
        return Ok(image_data_url(&encoded, mime_type.as_deref()));
    }
    Err(format!("Unexpected {} image response: {}", provider, json))
}

#[tauri::command]
fn copy_image_to_clipboard(app: tauri::AppHandle, base64_png: String) -> Result<(), String> {
    use base64::Engine;

    // Decode base64 → raw PNG bytes
    let encoded = base64_png
        .split_once(',')
        .map(|(_, value)| value)
        .unwrap_or(&base64_png);
    let png_bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    // Decode PNG → RGBA pixels
    let img = image::load_from_memory_with_format(&png_bytes, image::ImageFormat::Png)
        .map_err(|e| format!("PNG decode error: {}", e))?;
    let rgba = img.into_rgba8();
    let (width, height) = rgba.dimensions();
    let pixels = rgba.into_raw();

    // Write image to system clipboard
    app.clipboard().write_image(&tauri::image::Image::new_owned(pixels, width, height))
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn write_to_clipboard(app: tauri::AppHandle, text: String) -> Result<(), String> {
    app.clipboard().write_text(&text).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_clipboard_text(app: tauri::AppHandle) -> Result<String, String> {
    app.clipboard().read_text().map_err(|e| e.to_string())
}

#[tauri::command]
fn start_clipboard_monitor(app: tauri::AppHandle) {
    static STARTED: AtomicBool = AtomicBool::new(false);
    if STARTED.swap(true, Ordering::AcqRel) { return; }
    std::thread::spawn(move || {
        let mut previous = String::new();
        loop {
            std::thread::sleep(std::time::Duration::from_millis(700));
            if app.state::<ShortcutCaptureState>().in_progress.load(Ordering::Acquire) { continue; }
            let value = if let Ok(text) = app.clipboard().read_text() {
                if text.len() > 250000 { continue; }
                text
            } else if let Ok(img) = app.clipboard().read_image() {
                if img.width() as u64 * img.height() as u64 > 4_000_000 { continue; }
                let Some(rgba) = image::RgbaImage::from_raw(img.width(), img.height(), img.rgba().to_vec()) else { continue; };
                let mut buffer = std::io::Cursor::new(Vec::new());
                if image::DynamicImage::ImageRgba8(rgba).write_to(&mut buffer, image::ImageFormat::Png).is_err() { continue; }
                use base64::Engine;
                if buffer.get_ref().len() > 1_000_000 { continue; }
                format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(buffer.get_ref()))
            } else { continue; };
            if value != previous {
                previous = value.clone();
                if !value.trim().is_empty() { let _ = app.emit_to("main", "clipboard-captured", value); }
            }
        }
    });
}

#[tauri::command]
fn clipboard_command(app: tauri::AppHandle, command: String) -> Result<(), String> {
    app.emit("clipboard-command", command)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn paste_text(app: tauri::AppHandle, text: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    let source = app.state::<ShortcutCaptureState>().source_window.lock()
        .map_err(|e| e.to_string())?.clone()
        .ok_or("Automatic replacement is unavailable for this source app. Copy the result and paste it into your selection.")?;
    // 1. Backup original clipboard
    let original_clipboard = app.clipboard().read_text().ok();

    // 2. Write AI result to clipboard
    app.clipboard().write_text(&text).map_err(|e| e.to_string())?;

    // Hide the window
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }

    #[cfg(target_os = "linux")]
    {
        let restored = std::process::Command::new("timeout")
            .args(["2s", "xdotool", "windowactivate", "--sync", &source]).status()
            .map(|s| s.success()).unwrap_or(false);
        if !restored {
            if let Some(window) = app.get_webview_window("main") { let _ = window.show(); }
            return Err("Could not restore the source window. The result is on your clipboard for manual paste.".into());
        }
    }

    // Wait for focus
    std::thread::sleep(std::time::Duration::from_millis(300));

    // 3. Simulate Ctrl+V to paste
    simulate_chord('v');

    // 4. Restore original clipboard after a small delay to ensure paste finished
    if let Some(original) = original_clipboard {
        std::thread::sleep(std::time::Duration::from_millis(200));
        let _ = app.clipboard().write_text(&original);
    }

    Ok(())
}

fn get_mouse_pos() -> (i32, i32) {
    Enigo::new().mouse_location()
}

fn simulate_copy() {
    simulate_chord('c');
}

fn simulate_chord(key: char) {
    // On Linux, Enigo can target the wrong seat when the app is running through
    // XWayland. Prefer the native X11 event utility when it is available, then
    // keep Enigo as the portable fallback for other environments.
    #[cfg(target_os = "linux")]
    {
        if std::process::Command::new("xdotool")
            .args(["key", "--clearmodifiers", &format!("ctrl+{}", key)])
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
        {
            return;
        }
    }

    let mut enigo = Enigo::new();
    let modifier = if cfg!(target_os = "macos") { Key::Meta } else { Key::Control };
    enigo.key_down(modifier);
    std::thread::sleep(std::time::Duration::from_millis(50));
    enigo.key_click(Key::Layout(key));
    std::thread::sleep(std::time::Duration::from_millis(50));
    enigo.key_up(modifier);
}

#[tauri::command]
fn configure_shortcuts(
    app: tauri::AppHandle,
    app_shortcut: String,
    clipboard_shortcut: String,
) -> Result<(), String> {
    use tauri_plugin_global_shortcut::ShortcutState;
    let app_shortcut = Shortcut::from_str(&app_shortcut).map_err(|e| format!("{:?}", e))?;
    let clipboard_shortcut =
        Shortcut::from_str(&clipboard_shortcut).map_err(|e| format!("{:?}", e))?;

    if app_shortcut.id() == clipboard_shortcut.id() {
        return Err("The app and Clipboard shortcuts must be different.".to_string());
    }

    let clipboard_shortcut_id = clipboard_shortcut.id();
    let global_shortcut = app.global_shortcut();
    let _ = global_shortcut.unregister_all();
    global_shortcut
        .on_shortcuts([app_shortcut, clipboard_shortcut], move |app, shortcut, event| {
            // Trigger on Released to avoid clashing with the user's fingers holding down the shortcut keys.
            if !matches!(event.state(), ShortcutState::Released) {
                return;
            }

            if shortcut.id() == clipboard_shortcut_id {
                if let Err(error) = open_clipboard_only_window(app.clone()) {
                    eprintln!("Failed to open Clipboard shortcut window: {}", error);
                }
            } else {
                // Clipboard capture waits for the source app to respond. Keep the
                // global shortcut callback responsive so a second press can still
                // bring Ghost Writer back while that capture is in flight.
                let app = app.clone();
                std::thread::spawn(move || handle_shortcut(&app));
            }
        })
        .map_err(|e| format!("{:?}", e))?;
    Ok(())
}

fn handle_shortcut(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false) {
            app.state::<ShortcutCaptureState>().cancelled.store(true, Ordering::Release);
            let _ = window.hide();
            return;
        }
    }
    let capture_state = app.state::<ShortcutCaptureState>();
    if capture_state
        .in_progress
        .swap(true, Ordering::AcqRel)
    {
        capture_state.cancelled.store(true, Ordering::Release);
        // A second press during clipboard capture is an explicit request to
        // restore the window. The first capture will finish without hiding it.
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        return;
    }
    let _capture_guard = ShortcutCaptureGuard(&capture_state.in_progress);
    capture_state.cancelled.store(false, Ordering::Release);

    if let Some(window) = app.get_webview_window("main") {
        let was_visible = false;
        #[cfg(target_os = "linux")]
        {
            let source = std::process::Command::new("xdotool").arg("getactivewindow").output()
                .ok().filter(|o| o.status.success())
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());
            let source = source.filter(|id| std::process::Command::new("xdotool")
                .args(["getwindowpid", id]).output().ok()
                .filter(|o| o.status.success()).is_some());
            *capture_state.source_window.lock().unwrap() = source;
        }
        println!("[Logic] Shortcut Released - Starting Capture...");
        
        // 1. Hide the window to restore focus to the background app
        let _ = window.hide();
        
        
        // gives the user time to physically release the shortcut keys
        std::thread::sleep(std::time::Duration::from_millis(400));
        if capture_state.cancelled.load(Ordering::Acquire) { return; }

        // 2. Backup original clipboard
        let original_clipboard = app.clipboard().read_text().ok();
        println!("[Log] Clipboard backed up. length: {}", original_clipboard.as_ref().map(|s| s.len()).unwrap_or(0));

        // 3. Clear the clipboard briefly to ensure we don't read old data if capture fails
        let _ = app.clipboard().write_text("");
        std::thread::sleep(std::time::Duration::from_millis(50));

        // 4. Simulate Ctrl+C
        simulate_copy();
        println!("[Log] Ctrl+C Simulated");

        // 5. Wait for OS/App to update clipboard
        std::thread::sleep(std::time::Duration::from_millis(500));

        // 6. Read captured text
        let captured = app.clipboard().read_text().unwrap_or_default();
        
        println!("[Log] Captured text length: {}", captured.len());
        
        // 7. Restore original clipboard
        if let Some(original) = original_clipboard {
            // Small gap before restoration
            std::thread::sleep(std::time::Duration::from_millis(150));
            let _ = app.clipboard().write_text(&original);
            println!("[Log] Clipboard restored");
        }

        // Emit the captured text to frontend
        if capture_state.cancelled.load(Ordering::Acquire) { return; }
        if captured.trim().is_empty() {
            *capture_state.source_window.lock().unwrap() = None;
        }
        let _ = window.emit("selection-captured", &captured);

        // If nothing was captured, toggle visibility instead of forcing open
        if captured.trim().is_empty() {
            if !was_visible {
                let (original_x, original_y) = get_mouse_pos();
                let mut x = original_x;
                let mut y = original_y;

                if let Ok(Some(monitor)) = app.monitor_from_point(x as f64, y as f64) {
                    let screen_size = monitor.size();
                    let screen_pos = monitor.position();
                    let win_w = 340;
                    let win_h = 450;

                    x -= win_w / 2;
                    y -= 40;

                    let max_x = screen_pos.x + screen_size.width as i32 - win_w;
                    let max_y = screen_pos.y + screen_size.height as i32 - win_h;

                    if x > max_x { x = max_x; }
                    if x < screen_pos.x { x = screen_pos.x; }
                    if y > max_y { y = max_y; }
                    if y < screen_pos.y { y = screen_pos.y; }
                }

                let _ = window.set_position(PhysicalPosition::new(x, y));
                let _ = window.show();
                let _ = window.set_focus();
                println!("[Logic] Window Shown (toggle)");
            }
            return;
        }

        // 8. Calculate position and show window
        let (original_x, original_y) = get_mouse_pos();
        let mut x = original_x;
        let mut y = original_y;
        
        if let Ok(Some(monitor)) = app.monitor_from_point(x as f64, y as f64) {
            let screen_size = monitor.size();
            let screen_pos = monitor.position();
            let win_w = 340;
            let win_h = 450;

            x -= win_w / 2;
            y -= 40;

            let max_x = screen_pos.x + screen_size.width as i32 - win_w;
            let max_y = screen_pos.y + screen_size.height as i32 - win_h;

            if x > max_x { x = max_x; }
            if x < screen_pos.x { x = screen_pos.x; }
            if y > max_y { y = max_y; }
            if y < screen_pos.y { y = screen_pos.y; }
        }

        let _ = window.set_position(PhysicalPosition::new(x, y));
        let _ = window.show();
        let _ = window.set_focus();
        println!("[Logic] Window Shown");
    }
}

#[derive(Serialize, Deserialize)]
struct WindowConfig {
    resizable: bool,
}

#[tauri::command]
fn encrypt_data(data: String) -> Result<String, String> {
    use aes::cipher::{block_padding::Pkcs7, BlockEncryptMut, KeyIvInit};
    use aes::Aes256;
    use sha2::{Digest, Sha256};
    type Aes256CbcEnc = cbc::Encryptor<Aes256>;

    let key_str = "abcdefghijklmnopqrstuvwxyz012345"; 
    let key_hash = Sha256::digest(key_str.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&key_hash);

    let iv = uuid::Uuid::new_v4().as_bytes()[..16].to_vec();
    
    let cipher = Aes256CbcEnc::new((&key).into(), (&iv[..16]).into());
    let pos = data.len();
    let mut buffer = vec![0u8; pos + 16]; 
    buffer[..pos].copy_from_slice(data.as_bytes());
    
    let ct = cipher.encrypt_padded_mut::<Pkcs7>(&mut buffer, pos)
        .map_err(|e| format!("Encryption failed: {:?}", e))?;
    
    Ok(format!("{}:{}", hex::encode(iv), hex::encode(ct)))
}

#[tauri::command]
fn decrypt_data(encrypted_data: String) -> Result<String, String> {
    use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};
    use aes::Aes256;
    use sha2::{Digest, Sha256};
    type Aes256CbcDec = cbc::Decryptor<Aes256>;

    let parts: Vec<&str> = encrypted_data.split(':').collect();
    if parts.len() != 2 {
        return Err("Invalid encrypted data format".to_string());
    }

    let iv = hex::decode(parts[0]).map_err(|e| e.to_string())?;
    let ct = hex::decode(parts[1]).map_err(|e| e.to_string())?;
    
    let key_str = "abcdefghijklmnopqrstuvwxyz012345";
    let key_hash = Sha256::digest(key_str.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&key_hash);
    
    let cipher = Aes256CbcDec::new((&key).into(), (&iv[..]).into());
    let mut buffer = ct.clone();
    
    let pt = cipher.decrypt_padded_mut::<Pkcs7>(&mut buffer)
        .map_err(|e| format!("Decryption failed: {:?}", e))?;
    
    String::from_utf8(pt.to_vec()).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_window_config(window: tauri::Window) -> WindowConfig {
    WindowConfig {
        resizable: window.is_resizable().unwrap_or(false),
    }
}

#[tauri::command]
fn open_notepad_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(notepad_win) = app.get_webview_window("notepad") {
        let _ = notepad_win.show();
        let _ = notepad_win.unminimize();
        let _ = notepad_win.set_focus();
    } else {
        let _win = tauri::WebviewWindowBuilder::new(
            &app,
            "notepad",
            tauri::WebviewUrl::App("notepad.html".into())
        )
        .title("Ghost Writer Notepad")
        .inner_size(580.0, 660.0)
        .min_inner_size(360.0, 400.0)
        .resizable(true)
        .always_on_top(true)
        .decorations(false)
        .transparent(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn close_notepad_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(notepad_win) = app.get_webview_window("notepad") {
        let _ = notepad_win.hide();
    }
    Ok(())
}

#[tauri::command]
fn open_clipboard_window(app: tauri::AppHandle) -> Result<(), String> {
    show_clipboard_window(app)
}

fn show_clipboard_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(clipboard_win) = app.get_webview_window("clipboard") {
        let _ = clipboard_win.show();
        let _ = clipboard_win.unminimize();
        let _ = clipboard_win.set_focus();
    } else {
        let _win = tauri::WebviewWindowBuilder::new(
            &app,
            "clipboard",
            tauri::WebviewUrl::App("clipboard.html".into())
        )
        .title("Ghost Writer Clipboard")
        .inner_size(420.0, 600.0)
        .min_inner_size(340.0, 420.0)
        .resizable(true)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_clipboard_only_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.hide();
    }
    show_clipboard_window(app)
}

#[tauri::command]
fn close_clipboard_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(clipboard_win) = app.get_webview_window("clipboard") {
        let _ = clipboard_win.hide();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    if std::env::var_os("WAYLAND_DISPLAY").is_some()
        && std::env::var_os("GDK_BACKEND").is_none()
    {
        // global-hotkey currently supports X11 on Linux, not native Wayland.
        // Run the GTK/WebKit window through XWayland so global shortcuts remain usable.
        std::env::set_var("GDK_BACKEND", "x11");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(ShortcutCaptureState::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" || window.label() == "notepad" || window.label() == "clipboard" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            process_text,
            paste_text,
            configure_shortcuts,
            get_window_config,
            write_to_clipboard,
            read_clipboard_text,
            start_clipboard_monitor,
            clipboard_command,
            encrypt_data,
            decrypt_data,
            generate_image,
            copy_image_to_clipboard,
            lm_ping,
            open_notepad_window,
            close_notepad_window,
            open_clipboard_window,
            open_clipboard_only_window,
            close_clipboard_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
