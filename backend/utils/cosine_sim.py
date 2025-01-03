from transformers import BertTokenizer, BertModel
import torch
import re
import random
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Load pre-trained model tokenizer (vocabulary)
tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')

# load embeddings
model = BertModel.from_pretrained('bert-base-uncased')

# Set the model in evaluation mode to deactivate the DropOut modules to have reproducible results during evaluation
model.eval()


def preprocess_text(text, random_mask_option=False, indexed_tokens=True):
    # Basic text normalization (optional)
    text = text.lower()
    # Remove punctuation and special characters
    text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
    text = re.sub(' +', ' ', text)  # Remove extra spaces
    text = text.strip()

    # Tokenize input
    tokenized_text = tokenizer.tokenize(text)

    '''Masking Option: To mask a token that we will try to predict back
    Masking a token can help improve the model's robustness and ability to generalize. 
    If the goal is to train or fine-tune a BERT model on a specific dataset using the MLM objective, we need to mask tokens during preprocessing. 
    This trains the model to better understand the context and improve its ability to predict or understand missing words.
    This helps the model to learn bidirectional context representations. 
    By predicting the masked tokens, BERT learns to understand the context of a word from both its left and right surroundings. 
    In here this is left optional because For tasks where we just want to extract embeddings for text 
    (e.g., for text similarity, clustering), masking is not necessary.'''
    if random_mask_option:
        mask_index = random.randint(
            1, len(tokenized_text) - 2) if len(tokenized_text) > 2 else 0
        if len(tokenized_text) > 0:
            tokenized_text[mask_index] = '[MASK]'

    '''Convert tokens to vocabulary indices
    BERT models and other transformer-based models require numerical input. 
    Specifically, they need token IDs that map to the model's vocabulary.'''
    if indexed_tokens:
        indexed_tokens = tokenizer.convert_tokens_to_ids(tokenized_text)
        return indexed_tokens
    else:
        return tokenized_text


def get_bert_embeddings(indexed_tokens):
    # Convert indexed tokens to tensor and create attention mask
    input_ids = torch.tensor([indexed_tokens])
    attention_mask = torch.tensor([[1] * len(indexed_tokens)])

    # Get the embeddings from BERT
    with torch.no_grad():
        outputs = model(input_ids, attention_mask=attention_mask)
        last_hidden_states = outputs.last_hidden_state

    # The embeddings of the `[CLS]` token (representing the whole sentence) can be used
    sentence_embedding = last_hidden_states[:, 0, :].squeeze()
    return sentence_embedding


def calculate_cosine_similarity(embedding1, embedding2):
    embedding1 = embedding1.unsqueeze(0)  # Add batch dimension
    embedding2 = embedding2.unsqueeze(0)  # Add batch dimension
    similarity = cosine_similarity(embedding1, embedding2)
    return similarity[0][0]


def create_sim_matrix(df):
    # for every row in the df, preprocess the value of each column after the first one
    all_similarities = []
    for i in range(len(df)):
        print(f'Processing row {i+1}...')
        steps = []
        for j in range(1, len(df.columns)):
            steps.append(get_bert_embeddings(preprocess_text(df.iloc[i, j])))

        # for every pair of steps, compute the cosine similarity

        # initializing a dataframe that is as long as the number of steps
        df_similarities = pd.DataFrame(np.ones((len(steps), len(steps))), columns=range(
            1, len(steps)+1), index=range(1, len(steps)+1))

        for j in range(len(steps)):
            for k in range(j+1, len(steps)):
                df_similarities.iloc[j, k] = calculate_cosine_similarity(
                    steps[j], steps[k])

        # make the bottom triangle of the matrix reflect the top triangle
        for j in range(len(steps)):
            for k in range(j+1, len(steps)):
                df_similarities.iloc[k, j] = df_similarities.iloc[j, k]

        df_similarities['Trial'] = i + 1

        # Append the dataframe to the list
        all_similarities.append(df_similarities)

    # Concatenate all similarity matrices into one dataframe
    full_sim_matrix = pd.concat(all_similarities, ignore_index=True)
    print(full_sim_matrix)
    average_matrix = full_sim_matrix.groupby("Trial").mean().mean(axis=0)
    return average_matrix.to_json()
