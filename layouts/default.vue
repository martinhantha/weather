<template>
  <div class="min-h-screen bg-gray-100 text-gray-900">
    <header class="border-b border-gray-200 bg-white shadow-sm">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <div class="flex items-baseline gap-2">
          <h1 class="text-xl font-semibold tracking-tight text-gray-900">
            Sarntal Wind
          </h1>
          <p class="text-sm text-gray-500">
            Live Berg- &amp; Talstationen
          </p>
        </div>
        <div class="flex items-center gap-3 text-sm text-gray-600">
          <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-400 bg-emerald-100 px-2.5 py-1 text-emerald-800">
            <span class="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            Live&nbsp;Daten
          </span>
          <span class="hidden sm:inline text-gray-500">
            Aktualisiert alle 2&nbsp;Sekunden
          </span>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>
