package com.codeinterview.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "problems")
public class Problem {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    @Column(nullable = false)
    private String title;
    @Column(nullable = false)
    private String difficulty;
    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;
    @Column(columnDefinition = "TEXT")
    private String examples;
    @Column(columnDefinition = "TEXT")
    private String testCases;
    @Column(columnDefinition = "TEXT")
    private String tags;
    private int timeLimit = 2000;
    private int memoryLimit = 256;
    private String createdBy;
    /** 负责人 ID（记录归属） */
    private String ownerId;
    /** 负责人名称（冗余展示） */
    private String ownerName;
    /** 授权协作者列表，JSON 数组：[{userId,userName,grantedAt,grantedBy}] */
    @Column(columnDefinition = "TEXT")
    private String collaborators;
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getExamples() { return examples; }
    public void setExamples(String examples) { this.examples = examples; }
    public String getTestCases() { return testCases; }
    public void setTestCases(String testCases) { this.testCases = testCases; }
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
    public int getTimeLimit() { return timeLimit; }
    public void setTimeLimit(int timeLimit) { this.timeLimit = timeLimit; }
    public int getMemoryLimit() { return memoryLimit; }
    public void setMemoryLimit(int memoryLimit) { this.memoryLimit = memoryLimit; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }
    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }
    public String getCollaborators() { return collaborators; }
    public void setCollaborators(String collaborators) { this.collaborators = collaborators; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
