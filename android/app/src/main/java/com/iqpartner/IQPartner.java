package com.iqpartner;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class IQPartner extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Install the splash screen before super.onCreate()
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }
}
