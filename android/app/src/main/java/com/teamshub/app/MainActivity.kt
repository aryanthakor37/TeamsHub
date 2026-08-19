package com.teamshub.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.teamshub.app.core.navigation.NavGraph
import com.teamshub.app.core.theme.TeamsHubTheme

import java.io.File
import java.io.FileWriter
import java.io.PrintWriter

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        Thread.setDefaultUncaughtExceptionHandler { _, e ->
            try {
                val file = File(getExternalFilesDir(null), "crash_log.txt")
                PrintWriter(FileWriter(file, true)).use {
                    it.println("CRASH AT ${System.currentTimeMillis()}")
                    e.printStackTrace(it)
                    it.println("-------------------------")
                }
            } catch (ex: Exception) {}
            android.os.Process.killProcess(android.os.Process.myPid())
            System.exit(1)
        }

        setContent {
            TeamsHubTheme {
                NavGraph()
            }
        }
    }
}
