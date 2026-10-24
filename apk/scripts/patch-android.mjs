// Run once after `cap add android`: a landscape game in full screen, with the screen kept on.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '..', 'android', 'app', 'src', 'main');
if (!fs.existsSync(app)) throw new Error('android/ is missing: run `npx cap add android` first');

// landscape either way up; the activity already handles rotation itself (configChanges)
const manifestPath = path.join(app, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:screenOrientation')) {
  manifest = manifest.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="sensorLandscape"');
  if (!manifest.includes('android:screenOrientation')) throw new Error('MainActivity not found in AndroidManifest.xml');
}
// WebGL needs the GPU path (it is the default, said here so no converter turns it off)
manifest = manifest.replace(/<application(?![^>]*hardwareAccelerated)/, '<application\n        android:hardwareAccelerated="true"');
fs.writeFileSync(manifestPath, manifest);

// the activity: system bars hidden (a swipe brings them back for a moment), screen kept on
const find = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? find(path.join(dir, e.name)) : e.name === 'MainActivity.java' ? [path.join(dir, e.name)] : []));
const [activity] = find(path.join(app, 'java'));
if (!activity) throw new Error('MainActivity.java not found');
const pkg = fs.readFileSync(activity, 'utf8').match(/^package\s+([\w.]+);/m)[1];
fs.writeFileSync(activity, `package ${pkg};

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        immersive();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    private void immersive() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.hide(WindowInsetsCompat.Type.systemBars());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
`);
console.log(`patched ${path.relative(process.cwd(), manifestPath)} and ${path.relative(process.cwd(), activity)}`);
