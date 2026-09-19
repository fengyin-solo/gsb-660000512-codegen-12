package com.codeinterview.controller;

import com.codeinterview.model.Problem;
import com.codeinterview.repository.ProblemRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/problems")
@CrossOrigin(origins = "*")
public class ProblemController {

    @Autowired
    private ProblemRepository problemRepository;

    @GetMapping
    public List<Problem> listProblems(
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) String tag) {
        if (difficulty != null && tag != null) {
            return problemRepository.findByDifficultyAndTagsContaining(difficulty, tag);
        } else if (difficulty != null) {
            return problemRepository.findByDifficulty(difficulty);
        } else if (tag != null) {
            return problemRepository.findByTagsContaining(tag);
        }
        return problemRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Problem> getProblem(@PathVariable String id) {
        Optional<Problem> problem = problemRepository.findById(id);
        return problem.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Problem createProblem(@RequestBody Problem problem) {
        // 新建记录：提交者即负责人
        if (problem.getOwnerId() == null || problem.getOwnerId().isBlank()) {
            problem.setOwnerId(problem.getCreatedBy());
        }
        return problemRepository.save(problem);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Problem> updateProblem(@PathVariable String id, @RequestBody Problem problemDetails) {
        return problemRepository.findById(id)
                .map(problem -> {
                    problem.setTitle(problemDetails.getTitle());
                    problem.setDifficulty(problemDetails.getDifficulty());
                    problem.setDescription(problemDetails.getDescription());
                    problem.setExamples(problemDetails.getExamples());
                    problem.setTestCases(problemDetails.getTestCases());
                    problem.setTags(problemDetails.getTags());
                    problem.setTimeLimit(problemDetails.getTimeLimit());
                    problem.setMemoryLimit(problemDetails.getMemoryLimit());
                    // 归属保持不变：普通更新不允许覆盖负责人
                    // 协作者名单由负责人通过显式字段维护
                    if (problemDetails.getCollaborators() != null) {
                        problem.setCollaborators(problemDetails.getCollaborators());
                    }
                    if (problem.getOwnerId() == null && problemDetails.getOwnerId() != null) {
                        problem.setOwnerId(problemDetails.getOwnerId());
                        problem.setOwnerName(problemDetails.getOwnerName());
                    }
                    Problem updated = problemRepository.save(problem);
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProblem(@PathVariable String id) {
        return problemRepository.findById(id)
                .map(problem -> {
                    problemRepository.delete(problem);
                    return ResponseEntity.ok().build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
