import { Capacitor } from "@capacitor/core";

/** True when running inside the native iOS/Android Capacitor shell (not the web build). */
export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

/** The platform we're running on: "ios", "android", or "web". */
export const getPlatform = (): string => Capacitor.getPlatform();
