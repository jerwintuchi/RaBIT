// Prevents an extra console window on Windows release builds. No effect in dev.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    rabit_lib::run();
}
