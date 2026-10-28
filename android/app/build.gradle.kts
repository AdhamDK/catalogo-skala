import java.util.Properties

plugins {
    id("com.android.application")
}

// Firma: keystore/keystore.properties (lo crea crear_llave.bat). Guardá esa carpeta: sin la
// misma llave, las actualizaciones no se pueden instalar encima.
val firma = Properties().apply {
    val f = rootProject.file("keystore/keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

// La URL del CRM sale de catalogo-skala/js/crm-api.js (una sola fuente)
val crmApi = rootProject.file("../catalogo-skala/js/crm-api.js")
val apiUrl: String = if (crmApi.exists())
    Regex("CRM_API_URL = \"([^\"]+)\"").find(crmApi.readText())?.groupValues?.get(1) ?: "" else ""

android {
    namespace = "com.skala.equipo"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.skala.equipo"
        minSdk = 24
        targetSdk = 34
        // Al publicar una APK nueva: subir versionCode y poner el mismo número en la hoja Config (version_apk)
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "API_URL", "\"$apiUrl\"")
    }

    signingConfigs {
        if (firma.getProperty("storeFile") != null) {
            create("skala") {
                storeFile = rootProject.file("keystore/" + firma.getProperty("storeFile"))
                storePassword = firma.getProperty("storePassword")
                keyAlias = firma.getProperty("keyAlias")
                keyPassword = firma.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (firma.getProperty("storeFile") != null) signingConfig = signingConfigs.getByName("skala")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }

    lint {
        // Que una advertencia de lint no frene la APK (las pantallas se prueban con tests/e2e-*.js)
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation("androidx.core:core:1.12.0")
    implementation("androidx.webkit:webkit:1.9.0")
    implementation("androidx.work:work-runtime:2.9.0")
}

// Las pantallas del panel (solo lo que va después de ingresar) se copian dentro de la app.
// El catálogo público no va en la app.
val copiarPantallas by tasks.registering(Sync::class) {
    from(rootProject.file("../catalogo-skala")) {
        include("panel.html", "manifest.webmanifest", "css/**", "js/**", "assets/img/web/**")
    }
    into(layout.projectDirectory.dir("src/main/assets/www"))
}
tasks.named("preBuild") { dependsOn(copiarPantallas) }
