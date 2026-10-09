/**
 * Build English-Cards.apk using the local Android SDK + Gradle wrapper.
 * Run after: vite build, `vite preview` on :8081, then `node scripts/sync-android.mjs`.
 * Do not use `sync-android-offline.mjs` — that writes an empty `#root` shell
 * and the WebView hydrates the whole document, so launch is blank.
 */
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ANDROID = join(ROOT, "android");
const LOCAL_PROPS = join(ANDROID, "local.properties");
const OUT_APK = join(ROOT, "English-Cards.apk");
const WRAPPER_DIR = join(ANDROID, "gradle", "wrapper");
const WRAPPER_JAR = join(WRAPPER_DIR, "gradle-wrapper.jar");
const WRAPPER_PROPS = join(WRAPPER_DIR, "gradle-wrapper.properties");
const GRADLEW_BAT = join(ANDROID, "gradlew.bat");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (r.status !== 0) fail(`Command failed (${r.status}): ${cmd}`);
}

function resolveSdk() {
  let sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";
  if (!sdkDir && existsSync(LOCAL_PROPS)) {
    const text = readFileSync(LOCAL_PROPS, "utf8");
    const m = text.match(/sdk\.dir\s*=\s*(.+)/);
    if (m) {
      sdkDir = m[1].trim().replace(/\\\\/g, "\\");
    }
  }
  if (!sdkDir || !existsSync(sdkDir)) {
    fail(`Android SDK not found. got=${sdkDir}`);
  }
  return sdkDir;
}

function download(url, dest) {
  console.log(`Downloading ${url}`);
  const ps = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Invoke-WebRequest -Uri '${url}' -OutFile '${dest.replace(/'/g, "''")}'`,
    ],
    { stdio: "inherit", shell: true },
  );
  if (ps.status === 0 && existsSync(dest)) return;
  const c = spawnSync("curl", ["-L", "-o", dest, url], {
    stdio: "inherit",
    shell: true,
  });
  if (c.status !== 0 || !existsSync(dest)) {
    fail(`Download failed: ${url}`);
  }
}

function ensureWrapper() {
  mkdirSync(WRAPPER_DIR, { recursive: true });

  if (!existsSync(WRAPPER_PROPS)) {
    writeFileSync(
      WRAPPER_PROPS,
      [
        "distributionBase=GRADLE_USER_HOME",
        "distributionPath=wrapper/dists",
        "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-bin.zip",
        "networkTimeout=10000",
        "validateDistributionUrl=true",
        "zipStoreBase=GRADLE_USER_HOME",
        "zipStorePath=wrapper/dists",
        "",
      ].join("\n"),
      "utf8",
    );
  }

  if (!existsSync(GRADLEW_BAT)) {
    const bat = [
      "@ECHO OFF",
      "SETLOCAL",
      "SET DIRNAME=%~dp0",
      'IF "%DIRNAME%"=="" SET DIRNAME=.',
      "SET APP_HOME=%DIRNAME%",
      "FOR %%i IN (\"%APP_HOME%\") DO SET APP_HOME=%%~fi",
      "SET CLASSPATH=%APP_HOME%\\gradle\\wrapper\\gradle-wrapper.jar",
      'IF NOT EXIST "%CLASSPATH%" (',
      "  ECHO Missing gradle-wrapper.jar",
      "  EXIT /B 1",
      ")",
      "SET JAVA_EXE=java.exe",
      'IF DEFINED JAVA_HOME SET JAVA_EXE=%JAVA_HOME%\\bin\\java.exe',
      '"%JAVA_EXE%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*',
      "EXIT /B %ERRORLEVEL%",
      "",
    ].join("\r\n");
    writeFileSync(GRADLEW_BAT, bat, "utf8");
  }

  if (!existsSync(WRAPPER_JAR)) {
    // Known good wrapper jar from Gradle GitHub tag
    download(
      "https://github.com/gradle/gradle/raw/v8.11.1/gradle/wrapper/gradle-wrapper.jar",
      WRAPPER_JAR,
    );
  }
}

const sdkDir = resolveSdk();
console.log(`SDK: ${sdkDir}`);
ensureWrapper();

run(GRADLEW_BAT, ["assembleDebug", "--no-daemon"], {
  cwd: ANDROID,
  env: {
    ANDROID_HOME: sdkDir,
    ANDROID_SDK_ROOT: sdkDir,
  },
});

const built = join(
  ANDROID,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk",
);
if (!existsSync(built)) fail(`APK not found at ${built}`);

copyFileSync(built, OUT_APK);
console.log("");
console.log(`APK ready: ${OUT_APK}`);
console.log(`Source: ${built}`);
