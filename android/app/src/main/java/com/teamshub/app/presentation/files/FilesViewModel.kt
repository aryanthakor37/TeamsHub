package com.teamshub.app.presentation.files

import androidx.lifecycle.ViewModel
import com.teamshub.app.data.repository.MockRepository
import com.teamshub.app.domain.model.FileItem
import com.teamshub.app.domain.repository.TeamsHubRepository

class FilesViewModel(
    private val repository: TeamsHubRepository = MockRepository()
) : ViewModel() {

    fun getFiles(): List<FileItem> = repository.getFiles()
}
