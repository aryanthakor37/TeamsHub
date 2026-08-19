package com.teamshub.app.presentation.search

import androidx.lifecycle.ViewModel
import com.teamshub.app.data.repository.MockRepository
import com.teamshub.app.domain.repository.TeamsHubRepository

class SearchViewModel(
    private val repository: TeamsHubRepository = MockRepository()
) : ViewModel() {

    fun search(query: String): List<String> = repository.searchWorkspace(query)
}
