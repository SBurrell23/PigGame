<template>
  <details class="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-600 overflow-hidden transition-colors duration-300">
    <summary class="p-4 bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-semibold text-gray-700 dark:text-gray-300">
      📖 How to Play
    </summary>
    <div class="p-4 bg-white dark:bg-gray-800 transition-colors duration-300">
      <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-2 transition-colors duration-300">
        <li class="flex items-center"><span class="text-green-500 mr-2">🎲</span> Roll the dice to accumulate points for your turn.</li>
        <li class="flex items-center"><span class="text-yellow-500 mr-2">💰</span> "Bank Points" to save your turn points and pass to next player.</li>
        <li class="flex items-center"><span class="text-red-500 mr-2">🐷</span> Rolling a 1 when you have turn points will end your turn and cause you to lose them!</li>
  <li class="flex items-center"><span class="text-purple-500 mr-2">🏆</span> First player to reach the max points wins!</li>
      </ul>
    </div>
  </details>
</template>
