<template>
  <details class="bg-white rounded-xl shadow-md overflow-hidden">
    <summary class="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors font-semibold text-gray-700">
      📖 How to Play
    </summary>
    <div class="p-4 bg-white">
      <ul class="text-sm text-gray-600 space-y-2">
        <li class="flex items-center"><span class="text-green-500 mr-2">🎲</span> Roll the dice to accumulate points for your turn.</li>
        <li class="flex items-center"><span class="text-yellow-500 mr-2">💰</span> "Bank Points" to save your turn points and pass to next player.</li>
        <li class="flex items-center"><span class="text-red-500 mr-2">🐷</span> Rolling a 1 when you have turn points will end your turn and cause you to lose them!</li>
        <li class="flex items-center"><span class="text-purple-500 mr-2">🏆</span> First player to reach 100 points wins!</li>
      </ul>
    </div>
  </details>
</template>
