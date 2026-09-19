package com.serveryyswys.overmem

import android.app.Application
import com.serveryyswys.overmem.util.CrashHandler

class OverMemApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        CrashHandler.install(this)
    }
}