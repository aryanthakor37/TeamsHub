package com.teamshub.app.presentation.accounts

import androidx.lifecycle.ViewModel
import com.teamshub.app.data.repository.MockRepository
import com.teamshub.app.domain.model.Account
import com.teamshub.app.domain.repository.TeamsHubRepository

class AccountsViewModel(
    private val repository: TeamsHubRepository = MockRepository()
) : ViewModel() {

    fun getAccounts(): List<Account> = repository.getAccounts()
}
